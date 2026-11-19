<?php

namespace App\Actions\Imports;

use App\Actions\Clients\CreateClient;
use App\Actions\Projects\SaveProject;
use App\Actions\TimeEntries\CreateTimeEntry;
use App\Data\TimeEntryData;
use App\Enums\ProjectVisibility;
use App\Enums\TimeEntrySource;
use App\Models\Client;
use App\Models\Organization;
use App\Models\Project;
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
    ) {
        //
    }

    /**
     * Import a Clockify export into the organization: create the missing clients and projects, then
     * every importable entry through CreateTimeEntry (same rules as the web app, source "import").
     * Rows the plan skips, or that fail validation, are reported instead of stopping the import.
     *
     * @param  array<string, int|null>  $memberMap  email => member id, null skips the user
     * @param  array<string, bool>  $billableByProject  project key => billable, for new projects
     * @return array{created: int, seconds: int, clientsCreated: int, projectsCreated: int, from: string|null, to: string|null, skipped: array<int, array{line: int, date: string|null, user: string|null, project: string|null, reason: string}>}
     *
     * @throws ValidationException
     */
    public function handle(Organization $organization, User $importer, ClockifyCsv $csv, array $memberMap, array $billableByProject): array
    {
        $plan = new ClockifyImportPlan($organization, $importer, $csv, $memberMap, $billableByProject);

        if ($plan->entries === []) {
            throw ValidationException::withMessages(['import' => __('There is nothing to import.')]);
        }

        return DB::transaction(function () use ($organization, $plan) {
            $projectIds = $this->projects($organization, $plan);
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
     * Project ids by match key, creating the new projects (and their clients) that get time.
     *
     * @return array<string, int>
     */
    private function projects(Organization $organization, ClockifyImportPlan $plan): array
    {
        $usedKeys = array_flip(array_map(fn (array $entry) => $entry['projectKey'], $plan->entries));
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
