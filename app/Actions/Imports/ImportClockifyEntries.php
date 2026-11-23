<?php

namespace App\Actions\Imports;

use App\Actions\Clients\CreateClient;
use App\Actions\Organizations\AddInvitedMember;
use App\Actions\Projects\AssignProjectMember;
use App\Actions\Projects\SaveProject;
use App\Actions\TimeEntries\CreateTimeEntry;
use App\Actions\TimeEntries\RepriceTimeEntry;
use App\Data\TimeEntryData;
use App\Enums\ProjectVisibility;
use App\Enums\TimeEntrySource;
use App\Models\Client;
use App\Models\Organization;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Imports\ClockifyCsv;
use App\Services\Imports\ClockifyImportPlan;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ImportClockifyEntries
{
    public function __construct(
        private readonly CreateClient $createClient,
        private readonly SaveProject $saveProject,
        private readonly CreateTimeEntry $createTimeEntry,
        private readonly AssignProjectMember $assignProjectMember,
        private readonly RepriceTimeEntry $repriceTimeEntry,
        private readonly AddInvitedMember $addInvitedMember,
    ) {
        //
    }

    /**
     * Import a Clockify export into the organization: create the missing clients and projects, save
     * the hourly rates chosen in the preview as the members' rates on those projects, then create
     * every importable entry through CreateTimeEntry (same rules as the web app, source "import"), so
     * the entries get the chosen rates from the rate order. With $updateExisting, rows an earlier
     * import already created get the current rate and billable setting instead. People with a pending
     * invitation who get time are added as members first (AddInvitedMember).
     * Rows the plan skips, or that fail validation, are reported instead of stopping the import.
     *
     * @param  array<string, int|null>  $memberMap  email => member id (or ClockifyImportPlan::invitationMemberId()), null skips the user
     * @param  array<string, bool>  $billableByProject  project key => billable, for new projects
     * @param  array<string, int|null>  $rates  ClockifyImportPlan::rateKey() => hourly rate in minor units
     * @return array{created: int, updated: int, seconds: int, clientsCreated: int, projectsCreated: int, from: string|null, to: string|null, skipped: array<int, array{line: int, date: string|null, user: string|null, project: string|null, reason: string}>}
     *
     * @throws ValidationException
     */
    public function handle(Organization $organization, User $importer, ClockifyCsv $csv, array $memberMap, array $billableByProject, array $rates = [], bool $updateExisting = false): array
    {
        $plan = new ClockifyImportPlan($organization, $importer, $csv, $memberMap, $billableByProject, $rates);

        if ($plan->entries === [] && (! $updateExisting || $plan->alreadyImported === [])) {
            throw ValidationException::withMessages(['import' => __('There is nothing to import.')]);
        }

        return DB::transaction(function () use ($organization, $importer, $csv, $memberMap, $billableByProject, $rates, $plan, $updateExisting) {
            $plan = $this->addInvitedMembers($organization, $importer, $csv, $memberMap, $billableByProject, $rates, $plan);
            $projectIds = $this->projects($organization, $plan);
            $this->saveRates($organization, $plan, $projectIds);
            $updated = $updateExisting ? $this->updateExisting($organization, $plan) : 0;
            $skipped = $plan->skipped;
            $created = 0;
            $seconds = 0;

            foreach ($plan->entries as $entry) {
                $row = $entry['row'];

                try {
                    $timeEntry = $this->createTimeEntry->handle($organization, new TimeEntryData(
                        userId: $entry['userId'],
                        projectId: $projectIds[$entry['projectKey']],
                        startedAt: $entry['startedAt'],
                        endedAt: $entry['endedAt'],
                        description: $row->combinedDescription(),
                        isBillable: $row->billable,
                        source: TimeEntrySource::Import,
                        tags: $row->tags === [] ? null : $row->tags,
                    ));

                    $created++;
                    $seconds += $timeEntry->duration_seconds;
                } catch (ValidationException $exception) {
                    $message = collect($exception->errors())->flatten()->first();
                    $skipped[] = [
                        'line' => $row->line,
                        'date' => $entry['startedAt']->toDateString(),
                        'user' => $row->userName,
                        'project' => $row->project,
                        'reason' => is_string($message) ? $message : __('The entry could not be imported.'),
                    ];
                }
            }

            usort($skipped, fn (array $a, array $b) => $a['line'] <=> $b['line']);
            $newProjects = array_filter($plan->projects, fn (array $project) => $project['projectId'] === null && isset($projectIds[$project['key']]));

            return [
                'created' => $created,
                'updated' => $updated,
                'seconds' => $seconds,
                'clientsCreated' => count($plan->newClients),
                'projectsCreated' => count($newProjects),
                'from' => $plan->from,
                'to' => $plan->to,
                'skipped' => $skipped,
            ];
        });
    }

    /**
     * Add the invited people who get time as members, then plan again with their user ids in place of
     * the stand-in ids (their emails now match them as members).
     *
     * @param  array<string, int|null>  $memberMap
     * @param  array<string, bool>  $billableByProject
     * @param  array<string, int|null>  $rates
     */
    private function addInvitedMembers(Organization $organization, User $importer, ClockifyCsv $csv, array $memberMap, array $billableByProject, array $rates, ClockifyImportPlan $plan): ClockifyImportPlan
    {
        $userIds = [];

        foreach ($plan->invitationsWithTime() as $memberId => $item) {
            $userIds[$memberId] = $this->addInvitedMember->handle($item['invitation'], $item['name'])->id;
        }

        if ($userIds === []) {
            return $plan;
        }

        $memberMap = array_map(fn (?int $memberId) => $memberId === null ? null : ($userIds[$memberId] ?? $memberId), $memberMap);
        $remappedRates = [];

        foreach ($rates as $rateKey => $rate) {
            $separator = (int) strrpos($rateKey, '|');
            $memberId = (int) substr($rateKey, $separator + 1);
            $remappedRates[isset($userIds[$memberId]) ? ClockifyImportPlan::rateKey(substr($rateKey, 0, $separator), $userIds[$memberId]) : $rateKey] = $rate;
        }

        return new ClockifyImportPlan($organization, $importer, $csv, $memberMap, $billableByProject, $remappedRates);
    }

    /**
     * Save the rates that differ from the rate order as the members' rates on the projects.
     *
     * @param  array<string, int>  $projectIds
     */
    private function saveRates(Organization $organization, ClockifyImportPlan $plan, array $projectIds): void
    {
        $changed = array_filter($plan->changedRates(), fn (array $rate) => isset($projectIds[$rate['projectKey']]));

        if ($changed === []) {
            return;
        }

        $projects = Project::query()->forOrganization($organization)->with('organization')->findMany(array_values($projectIds))->keyBy('id');
        $users = $organization->members()->whereIn('users.id', array_column($changed, 'userId'))->get()->keyBy('id');

        foreach ($changed as $rate) {
            $project = $projects->get($projectIds[$rate['projectKey']]);
            $user = $users->get($rate['userId']);

            if ($project !== null && $user !== null) {
                $this->assignProjectMember->handle($project, $user, $rate['rate']);
            }
        }
    }

    /**
     * Give entries an earlier import created the current rate and billable setting. Only entries with
     * source "import" are listed by the plan, so time reported in the app is never changed.
     */
    private function updateExisting(Organization $organization, ClockifyImportPlan $plan): int
    {
        $entries = TimeEntry::query()
            ->forOrganization($organization)
            ->whereIn('id', array_column($plan->alreadyImported, 'entryId'))
            ->with(['project.organization', 'user'])
            ->get()
            ->keyBy('id');
        $updated = 0;

        foreach ($plan->alreadyImported as $row) {
            $entry = $entries->get($row['entryId']);

            if ($entry !== null && $this->repriceTimeEntry->handle($entry, $row['row']->billable ?? $entry->project->is_billable)) {
                $updated++;
            }
        }

        return $updated;
    }

    /**
     * Project ids by match key, creating the new projects (and their clients) that get time.
     *
     * @return array<string, int>
     */
    private function projects(Organization $organization, ClockifyImportPlan $plan): array
    {
        // Projects of already imported rows exist; they are listed so their rates can be saved.
        $usedKeys = array_flip(array_map(fn (array $entry) => $entry['projectKey'], [...$plan->entries, ...$plan->alreadyImported]));
        $clientIds = Client::query()->forOrganization($organization)->get()
            ->mapWithKeys(fn (Client $client) => [ClockifyImportPlan::normalize($client->name) => $client->id])
            ->all();

        foreach ($plan->newClients as $name) {
            $clientIds[ClockifyImportPlan::normalize($name)] = $this->createClient->handle($organization, ['name' => $name])->id;
        }

        $colorIndex = Project::query()->forOrganization($organization)->count();
        $projectIds = [];

        foreach ($plan->projects as $project) {
            if (! isset($usedKeys[$project['key']])) {
                continue;
            }

            if ($project['projectId'] !== null) {
                $projectIds[$project['key']] = $project['projectId'];

                continue;
            }

            $projectIds[$project['key']] = $this->saveProject->handle($organization, [
                'name' => $project['name'],
                'client_id' => $project['client'] === null ? null : $clientIds[ClockifyImportPlan::normalize($project['client'])],
                'code' => null,
                'color' => Project::COLORS[$colorIndex++ % count(Project::COLORS)],
                'is_billable' => $project['billable'],
                'hourly_rate' => null,
                'estimate_seconds' => null,
                'visibility' => ProjectVisibility::Public->value,
                'starts_on' => null,
                'ends_on' => null,
            ])->id;
        }

        return $projectIds;
    }
}
