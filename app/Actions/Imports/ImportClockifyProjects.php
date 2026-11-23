<?php

namespace App\Actions\Imports;

use App\Actions\Clients\CreateClient;
use App\Actions\Projects\AssignProjectMember;
use App\Actions\Projects\SaveProject;
use App\Actions\Projects\SetProjectArchived;
use App\Enums\ProjectVisibility;
use App\Models\Client;
use App\Models\Organization;
use App\Models\Project;
use App\Models\User;
use App\Services\Imports\ClockifyImportPlan;
use App\Services\Imports\ClockifyProjectPlan;
use App\Services\Imports\ClockifyProjectsCsv;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ImportClockifyProjects
{
    public function __construct(
        private readonly CreateClient $createClient,
        private readonly SaveProject $saveProject,
        private readonly SetProjectArchived $setProjectArchived,
        private readonly AssignProjectMember $assignProjectMember,
    ) {
        //
    }

    /**
     * Create and update the organization's clients and projects from Clockify's project export, as
     * ClockifyProjectPlan describes, so time imported afterwards lands on projects with the right
     * status, visibility and members. Members are assigned without a project rate.
     *
     * @param  array<string, bool>  $billableByProject  project key => billable, for new projects
     * @return array{created: int, updated: int, clientsCreated: int}
     *
     * @throws ValidationException
     */
    public function handle(Organization $organization, ClockifyProjectsCsv $csv, array $billableByProject = []): array
    {
        $plan = new ClockifyProjectPlan($organization, $csv, $billableByProject);

        if ($plan->newProjects() === [] && $plan->changedProjects() === []) {
            throw ValidationException::withMessages(['import' => __('There is nothing to import.')]);
        }

        return DB::transaction(function () use ($organization, $plan) {
            $clientIds = Client::query()->forOrganization($organization)->get()
                ->mapWithKeys(fn (Client $client) => [ClockifyImportPlan::normalize($client->name) => $client->id])
                ->all();

            foreach ($plan->newClients as $name) {
                $clientIds[ClockifyImportPlan::normalize($name)] = $this->createClient->handle($organization, ['name' => $name])->id;
            }

            $colorIndex = Project::query()->forOrganization($organization)->count();
            $existing = Project::query()->forOrganization($organization)->with('organization')
                ->findMany(array_column($plan->changedProjects(), 'projectId'))->keyBy('id');
            $members = $organization->members()->whereIn('users.id', array_merge([], ...array_column($plan->projects, 'newMemberIds')))->get()->keyBy('id');

            foreach ($plan->newProjects() as $item) {
                $project = $this->saveProject->handle($organization, [
                    'name' => $item['name'],
                    'client_id' => $item['client'] === null ? null : $clientIds[ClockifyImportPlan::normalize($item['client'])],
                    'code' => null,
                    'color' => Project::COLORS[$colorIndex++ % count(Project::COLORS)],
                    'is_billable' => $item['billable'],
                    'hourly_rate' => null,
                    'estimate_seconds' => $item['estimateSeconds'],
                    'visibility' => ($item['private'] ? ProjectVisibility::Private : ProjectVisibility::Public)->value,
                    'starts_on' => null,
                    'ends_on' => null,
                    'notes' => $item['note'],
                ]);
                $project->setRelation('organization', $organization);
                $this->finish($project, $item, $members);
            }

            foreach ($plan->changedProjects() as $item) {
                $project = $existing->get($item['projectId']);

                if ($project === null) {
                    continue;
                }

                if (array_intersect($item['changes'], ['private', 'note', 'estimate']) !== []) {
                    $this->saveProject->handle($organization, [
                        'name' => $project->name,
                        'client_id' => $project->client_id,
                        'code' => $project->code,
                        'color' => $project->color,
                        'is_billable' => $project->is_billable,
                        'hourly_rate' => $project->hourly_rate,
                        'estimate_seconds' => in_array('estimate', $item['changes'], true) ? $item['estimateSeconds'] : $project->estimate_seconds,
                        'visibility' => (in_array('private', $item['changes'], true) ? ProjectVisibility::Private : $project->visibility)->value,
                        'starts_on' => $project->starts_on?->toDateString(),
                        'ends_on' => $project->ends_on?->toDateString(),
                        'notes' => in_array('note', $item['changes'], true) ? $item['note'] : $project->notes,
                    ], $project);
                }

                $this->finish($project, $item, $members, archive: in_array('archive', $item['changes'], true));
            }

            return [
                'created' => count($plan->newProjects()),
                'updated' => count($plan->changedProjects()),
                'clientsCreated' => count($plan->newClients),
            ];
        });
    }

    /**
     * Assign the new members, then archive (members first: an archived project still keeps them).
     *
     * @param  array{archived: bool, newMemberIds: list<int>}  $item
     * @param  Collection<int, User>  $members
     */
    private function finish(Project $project, array $item, Collection $members, ?bool $archive = null): void
    {
        foreach ($item['newMemberIds'] as $userId) {
            $user = $members->get($userId);

            if ($user !== null) {
                $this->assignProjectMember->handle($project, $user);
            }
        }

        if ($archive ?? $item['archived']) {
            $this->setProjectArchived->handle($project, true);
        }
    }
}
