<?php

namespace App\Http\Controllers\Organizations;

use App\Actions\Imports\ImportClockifyEntries;
use App\Http\Controllers\Controller;
use App\Http\Requests\Imports\ClockifyImportChoicesRequest;
use App\Http\Requests\Imports\UploadClockifyImportRequest;
use App\Models\Organization;
use App\Models\User;
use App\Services\Imports\ClockifyCsv;
use App\Services\Imports\ClockifyImportPlan;
use App\Support\PendingImports;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Import from Clockify in three steps: upload the CSV export, review a preview (map users to
 * members, choose billable for new projects), then import.
 */
class OrganizationImportController extends Controller
{
    /** Skipped rows listed in the preview and the result; the rest are only counted. */
    private const int MAX_LISTED_SKIPPED = 300;

    public function __construct(private readonly PendingImports $pendingImports)
    {
        //
    }

    public function create(Organization $organization): Response
    {
        Gate::authorize('import', $organization);

        return Inertia::render('organizations/import', [
            'organization' => ['name' => $organization->name, 'slug' => $organization->slug],
            'preview' => null,
        ]);
    }

    public function store(UploadClockifyImportRequest $request, #[CurrentUser] User $user, Organization $organization): RedirectResponse
    {
        Gate::authorize('import', $organization);

        $contents = $request->csvContents();
        // Fail early when it isn't a Clockify export.
        ClockifyCsv::fromString($contents);

        $token = $this->pendingImports->put($organization, $user, $contents);

        return to_route('organizations.import.show', ['organization' => $organization->slug, 'import' => $token]);
    }

    public function show(ClockifyImportChoicesRequest $request, #[CurrentUser] User $user, Organization $organization, string $import): Response|RedirectResponse
    {
        Gate::authorize('import', $organization);

        $contents = $this->pendingImports->get($organization, $user, $import);

        if ($contents === null) {
            return $this->expired($organization);
        }

        $plan = new ClockifyImportPlan($organization, $user, ClockifyCsv::fromString($contents), $request->memberMap(), $request->billableByProject());

        return Inertia::render('organizations/import', [
            'organization' => ['name' => $organization->name, 'slug' => $organization->slug],
            'preview' => [
                'token' => $import,
                'dateFormat' => strtr($plan->csv->dateFormat, ['m' => 'MM', 'd' => 'DD', 'Y' => 'YYYY']),
                'timezone' => $plan->timezone(),
                'from' => $plan->from,
                'to' => $plan->to,
                'rows' => count($plan->csv->rows) + count($plan->csv->errors),
                'importable' => count($plan->entries),
                'importableSeconds' => $plan->importableSeconds(),
                'members' => $plan->members,
                'projects' => array_map(fn (array $project) => [
                    'key' => $project['key'],
                    'name' => $project['name'],
                    'client' => $project['client'],
                    'isNew' => $project['projectId'] === null,
                    'isArchived' => $project['isArchived'],
                    'billable' => $project['billable'],
                    'entries' => $project['entries'],
                    'seconds' => $project['seconds'],
                ], $plan->projects),
                'newClients' => $plan->newClients,
                'skipped' => array_slice($plan->skipped, 0, self::MAX_LISTED_SKIPPED),
                'skippedCount' => count($plan->skipped),
                'skippedReasons' => $this->reasons($plan->skipped),
            ],
            'memberOptions' => $organization->members()->wherePivotNull('deactivated_at')->orderBy('name')->get()
                ->map(fn (User $member) => ['value' => (string) $member->id, 'label' => "{$member->name} ({$member->email})"])
                ->values(),
        ]);
    }

    public function import(ClockifyImportChoicesRequest $request, #[CurrentUser] User $user, Organization $organization, string $import, ImportClockifyEntries $importEntries): RedirectResponse
    {
        Gate::authorize('import', $organization);

        $contents = $this->pendingImports->get($organization, $user, $import);

        if ($contents === null) {
            return $this->expired($organization);
        }

        $result = $importEntries->handle($organization, $user, ClockifyCsv::fromString($contents), $request->memberMap(), $request->billableByProject());
        $this->pendingImports->forget($organization, $user, $import);

        Inertia::flash('importResult', [
            ...$result,
            'skipped' => array_slice($result['skipped'], 0, self::MAX_LISTED_SKIPPED),
            'skippedCount' => count($result['skipped']),
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => trans_choice(':count entry imported.|:count entries imported.', $result['created'], ['count' => $result['created']])]);

        return to_route('organizations.import.create', ['organization' => $organization->slug]);
    }

    public function destroy(#[CurrentUser] User $user, Organization $organization, string $import): RedirectResponse
    {
        Gate::authorize('import', $organization);

        $this->pendingImports->forget($organization, $user, $import);

        return to_route('organizations.import.create', ['organization' => $organization->slug]);
    }

    /**
     * How many rows are skipped for each reason, most common first.
     *
     * @param  array<int, array{reason: string}>  $skipped
     * @return array<int, array{reason: string, count: int}>
     */
    private function reasons(array $skipped): array
    {
        return collect($skipped)
            ->countBy('reason')
            ->sortDesc()
            ->map(fn (int $count, string $reason) => ['reason' => $reason, 'count' => $count])
            ->values()
            ->all();
    }

    private function expired(Organization $organization): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'warning', 'message' => __('The upload has expired. Upload the file again.')]);

        return to_route('organizations.import.create', ['organization' => $organization->slug]);
    }
}
