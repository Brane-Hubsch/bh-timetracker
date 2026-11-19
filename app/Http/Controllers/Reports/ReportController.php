<?php

namespace App\Http\Controllers\Reports;

use App\Enums\ReportGrouping;
use App\Enums\ReportPeriod;
use App\Http\Controllers\Controller;
use App\Http\Requests\Reports\ReportRequest;
use App\Models\Client;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Reports\ReportBuilder;
use App\Services\Reports\ReportExporter;
use App\Services\Reports\ReportFilters;
use App\Support\CurrentOrganization;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Reports: summary, detailed list, project follow-up and exports. Owners and admins see everyone's
 * time and amounts; members only their own time and no amounts (enforced by ReportFilters).
 */
class ReportController extends Controller
{
    public function __construct(
        private readonly CurrentOrganization $currentOrganization,
        private readonly ReportBuilder $reports,
    ) {
        //
    }

    public function summary(ReportRequest $request, #[CurrentUser] User $user): Response
    {
        $organization = $this->currentOrganization->getOrFail();
        $filters = $request->filters($user, $organization);

        return Inertia::render('reports/summary', [
            ...$this->shared($request, $filters),
            'summary' => $this->reports->summary($filters, $request->grouping(), $request->subGrouping()),
        ]);
    }

    public function detailed(ReportRequest $request, #[CurrentUser] User $user): Response
    {
        $organization = $this->currentOrganization->getOrFail();
        $filters = $request->filters($user, $organization);

        return Inertia::render('reports/detailed', [
            ...$this->shared($request, $filters),
            'entries' => $this->reports
                ->detailed($filters, $request->sort(), $request->direction())
                ->through(fn (TimeEntry $entry) => $this->reports->row($entry, $filters)),
            'totals' => $this->reports->totalsFor($filters),
        ]);
    }

    public function projects(#[CurrentUser] User $user): Response
    {
        $organization = $this->currentOrganization->getOrFail();

        return Inertia::render('reports/projects', [
            'projects' => $this->reports->projectFollowUp($organization, $user),
        ]);
    }

    public function export(ReportRequest $request, #[CurrentUser] User $user, ReportExporter $exporter): SymfonyResponse
    {
        $request->validate([
            'type' => ['required', Rule::in(['summary', 'detailed'])],
            'format' => ['required', Rule::in(['csv', 'xlsx', 'pdf'])],
        ]);

        $filters = $request->filters($user, $this->currentOrganization->getOrFail());
        $format = match ($request->string('format')->value()) {
            'csv' => 'csv',
            'pdf' => 'pdf',
            default => 'xlsx',
        };

        return $request->string('type')->value() === 'summary'
            ? $exporter->summary($filters, $request->grouping(), $request->subGrouping(), $format)
            : $exporter->detailed($filters, $request->sort(), $request->direction(), $format);
    }

    /**
     * Filters, filter choices and abilities shared by the summary and detailed pages.
     *
     * @return array<string, mixed>
     */
    private function shared(Request $request, ReportFilters $filters): array
    {
        assert($request instanceof ReportRequest);
        $organization = $filters->organization;

        return [
            'filters' => $request->echo($filters),
            'options' => [
                'periods' => ReportPeriod::options(),
                'groupings' => ReportGrouping::options(),
                'members' => $filters->canViewTeam() ? $this->memberOptions($organization) : [],
                'clients' => $this->clientOptions($organization, $filters->viewer),
                'projects' => $this->projectOptions($organization, $filters->viewer),
            ],
            'abilities' => [
                'canViewTeam' => $filters->canViewTeam(),
                'canViewAmounts' => $filters->canViewAmounts(),
            ],
            'currency' => $organization->currency,
            'weekStartsOn' => $organization->week_starts_on,
        ];
    }

    /**
     * All members, including deactivated ones (their history is still reported).
     *
     * @return array<int, array{value: string, label: string}>
     */
    private function memberOptions(Organization $organization): array
    {
        return $organization->members()
            ->orderBy('name')
            ->get(['users.id', 'users.name'])
            ->map(function (User $member): array {
                /** @var Membership $membership */
                $membership = $member->getRelation('pivot');

                return [
                    'value' => (string) $member->id,
                    'label' => $membership->isDeactivated()
                        ? __(':name (inactive)', ['name' => $member->name])
                        : $member->name,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    private function clientOptions(Organization $organization, User $viewer): array
    {
        return Client::query()
            ->whereIn('id', Project::query()->accessibleBy($viewer, $organization)->whereNotNull('client_id')->select('client_id'))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Client $client) => ['value' => (string) $client->id, 'label' => $client->name])
            ->values()
            ->all();
    }

    /**
     * Projects the viewer can access, archived ones included (they still appear in reports).
     *
     * @return array<int, array{value: string, label: string}>
     */
    private function projectOptions(Organization $organization, User $viewer): array
    {
        return Project::query()
            ->accessibleBy($viewer, $organization)
            ->with('client:id,name')
            ->orderBy('name')
            ->get()
            ->map(fn (Project $project) => [
                'value' => (string) $project->id,
                'label' => $project->client ? "{$project->name} · {$project->client->name}" : $project->name,
            ])
            ->values()
            ->all();
    }
}
