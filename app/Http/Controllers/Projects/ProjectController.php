<?php

namespace App\Http\Controllers\Projects;

use App\Actions\Projects\SaveProject;
use App\Actions\Projects\SetProjectArchived;
use App\Enums\OrganizationPermission;
use App\Enums\ProjectVisibility;
use App\Enums\ReportGrouping;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\ProjectRequest;
use App\Models\Client;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Services\Reports\ReportBuilder;
use App\Services\Reports\ReportFilters;
use App\Support\CurrentOrganization;
use App\Support\EstimatePace;
use App\Support\ProjectFormOptions;
use App\Support\TimeEntryPresenter;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function __construct(private readonly CurrentOrganization $currentOrganization)
    {
        //
    }

    public function index(Request $request, #[CurrentUser] User $user, ProjectFormOptions $formOptions): Response
    {
        Gate::authorize('viewAny', Project::class);

        $organization = $this->currentOrganization->getOrFail();
        $status = $request->query('status') === 'archived' ? 'archived' : 'active';
        $search = $request->string('search')->value();
        $clientId = $request->integer('client') ?: null;

        $projects = Project::query()
            ->accessibleBy($user, $organization)
            ->with('client')
            ->withSum('timeEntries as consumed_seconds', 'duration_seconds')
            ->when($status === 'archived', fn ($query) => $query->archived(), fn ($query) => $query->active())
            ->when($clientId, fn ($query) => $query->where('client_id', $clientId))
            ->search($search)
            ->orderBy('name')
            ->get();

        $canViewRates = $user->can('viewRates', $organization);

        return Inertia::render('projects/index', [
            'projects' => $projects->map(fn (Project $project) => [
                ...$this->listItem($project),
                // All time reported on the project, as on the project page and in the follow-up report.
                'consumedSeconds' => is_numeric($consumed = $project->getAttribute('consumed_seconds')) ? (int) $consumed : 0,
                'hourlyRate' => $canViewRates ? $project->hourly_rate : null,
            ]),
            'canViewRates' => $canViewRates,
            'currency' => $organization->currency,
            'clients' => Client::query()->active()->orderBy('name')->get(['id', 'name'])
                ->when(! $user->can('viewAny', Client::class), fn ($clients) => $clients
                    ->whereIn('id', $projects->pluck('client_id')->filter()->all())
                    ->values()),
            'filters' => ['search' => $search, 'status' => $status, 'client' => $clientId],
            'projectForm' => $user->can('create', Project::class) ? $formOptions->for($organization) : null,
        ]);
    }

    public function store(ProjectRequest $request, SaveProject $saveProject): RedirectResponse
    {
        Gate::authorize('create', Project::class);

        $project = $saveProject->handle($this->currentOrganization->getOrFail(), $request->projectAttributes());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Project created.')]);

        return to_route('projects.show', ['project' => $project->id]);
    }

    public function show(#[CurrentUser] User $user, Project $project, ReportBuilder $reports, TimeEntryPresenter $presenter, ProjectFormOptions $formOptions): Response
    {
        Gate::authorize('view', $project);

        $project->load(['client', 'members']);
        $organization = $this->currentOrganization->getOrFail();
        $canViewRates = $user->can('viewRates', $organization);
        $canManage = $user->can('update', $project);
        $consumedSeconds = $project->consumedSeconds();

        return Inertia::render('projects/show', [
            'project' => [
                ...$this->listItem($project),
                'hourlyRate' => $canViewRates ? $project->hourly_rate : null,
                'visibility' => $project->visibility->value,
                'startsOn' => $project->starts_on?->toDateString(),
                'endsOn' => $project->ends_on?->toDateString(),
                'notes' => $project->notes,
                'consumedSeconds' => $consumedSeconds,
            ],
            // Hours left to the estimate and the pace needed per working day.
            'estimatePace' => EstimatePace::for($project, $consumedSeconds, CarbonImmutable::now($user->timezone)),
            'members' => $project->members->map(fn (User $member) => [
                'id' => $member->id,
                'name' => $member->name,
                'email' => $member->email,
                'avatar' => $member->avatar,
                'hourlyRate' => $canViewRates ? $this->assignment($member)?->hourly_rate : null,
            ]),
            'assignableMembers' => $canManage
                ? $organization->members()
                    ->wherePivotNull('deactivated_at')
                    ->whereNotIn('users.id', $project->members->modelKeys())
                    ->orderBy('name')
                    ->get(['users.id', 'users.name'])
                    ->map(fn (User $member) => ['value' => (string) $member->id, 'label' => $member->name])
                : [],
            // Time per member and per week (last 12 weeks) for owners and admins; members only see
            // their own time in reports.
            'breakdown' => $user->hasOrganizationPermission($organization, OrganizationPermission::ManageTeamTime)
                ? $this->breakdown($reports, $presenter, $project, $user)
                : null,
            'currency' => $organization->currency,
            'projectForm' => $canManage ? $formOptions->for($organization) : null,
            'abilities' => [
                'manage' => $canManage,
                'viewRates' => $canViewRates,
            ],
        ]);
    }

    /**
     * @return array{totals: array{seconds: int, billableSeconds: int, amount: int|null}, members: array<int, array{key: string, label: string, seconds: int, billableSeconds: int, amount: int|null}>, weeks: array<int, array{key: string, seconds: int, billableSeconds: int}>}
     */
    private function breakdown(ReportBuilder $reports, TimeEntryPresenter $presenter, Project $project, User $user): array
    {
        $organization = $this->currentOrganization->getOrFail();
        $allTime = $reports->summary(
            new ReportFilters($organization, $user, from: null, to: null, projectIds: [$project->id]),
            ReportGrouping::Member,
        );

        $today = CarbonImmutable::now($user->timezone)->startOfDay();
        $recent = $reports->summary(
            new ReportFilters($organization, $user, from: $presenter->weekStart($today, $organization)->subWeeks(11), to: $today, projectIds: [$project->id]),
            ReportGrouping::Week,
        );

        return [
            'totals' => $allTime['totals'],
            'members' => array_map(fn (array $group) => [
                'key' => $group['key'],
                'label' => $group['label'],
                'seconds' => $group['seconds'],
                'billableSeconds' => $group['billableSeconds'],
                'amount' => $group['amount'],
            ], $allTime['groups']),
            'weeks' => $recent['timeline']['buckets'],
        ];
    }

    public function update(ProjectRequest $request, Project $project, SaveProject $saveProject): RedirectResponse
    {
        Gate::authorize('update', $project);

        $saveProject->handle($this->currentOrganization->getOrFail(), $request->projectAttributes(), $project);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Project updated.')]);

        return to_route('projects.show', ['project' => $project->id]);
    }

    public function archive(Project $project, SetProjectArchived $setArchived): RedirectResponse
    {
        Gate::authorize('update', $project);

        $setArchived->handle($project, true);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Project archived.')]);

        return back();
    }

    public function restore(Project $project, SetProjectArchived $setArchived): RedirectResponse
    {
        Gate::authorize('update', $project);

        $setArchived->handle($project, false);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Project restored.')]);

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function listItem(Project $project): array
    {
        return [
            'id' => $project->id,
            'name' => $project->name,
            'code' => $project->code,
            'color' => $project->color,
            'client' => $project->client ? ['id' => $project->client->id, 'name' => $project->client->name, 'logo' => $project->client->logoUrl()] : null,
            'isBillable' => $project->is_billable,
            'estimateSeconds' => $project->estimate_seconds,
            'isPrivate' => $project->visibility === ProjectVisibility::Private,
            'isArchived' => $project->isArchived(),
        ];
    }

    /**
     * The project_members pivot loaded through Project::members().
     */
    private function assignment(User $member): ?ProjectMember
    {
        $assignment = $member->getRelation('assignment');

        return $assignment instanceof ProjectMember ? $assignment : null;
    }
}
