<?php

namespace App\Services\Imports;

use App\Enums\ProjectVisibility;
use App\Models\Client;
use App\Models\Organization;
use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * What importing Clockify's project export would do, so old time can be imported onto projects with
 * the right status. Projects match on client and project name, like the time import.
 *
 * - New projects get Clockify's status (archived), visibility (private), estimate, note and members
 *   (matched on name among active members). Billable is chosen in the preview.
 * - Existing projects only change in one direction: they are archived and made private when they are
 *   in Clockify, get the note and estimate when they have none, and get Clockify's members that
 *   aren't assigned yet. Nothing is restored, made public, cleared or overwritten.
 */
final class ClockifyProjectPlan
{
    /** Longest note kept, like projects created elsewhere. */
    public const int MAX_NOTE_LENGTH = 10000;

    /**
     * @var list<array{key: string, line: int, name: string, client: string|null, projectId: int|null, archived: bool, private: bool, estimateSeconds: int|null, note: string|null, billable: bool, members: list<string>, newMemberIds: list<int>, changes: list<string>}>
     */
    public array $projects = [];

    /** @var list<string> */
    public array $newClients = [];

    /**
     * Member names in the file that match no active member (or more than one).
     *
     * @var list<string>
     */
    public array $unknownMembers = [];

    /**
     * @param  array<string, bool>  $billableByProject  project key => billable, for new projects
     */
    public function __construct(
        public readonly Organization $organization,
        public readonly ClockifyProjectsCsv $csv,
        array $billableByProject = [],
    ) {
        $this->build($billableByProject);
    }

    /**
     * Projects the import creates.
     *
     * @return list<array{key: string, line: int, name: string, client: string|null, projectId: int|null, archived: bool, private: bool, estimateSeconds: int|null, note: string|null, billable: bool, members: list<string>, newMemberIds: list<int>, changes: list<string>}>
     */
    public function newProjects(): array
    {
        return array_values(array_filter($this->projects, fn (array $project) => $project['projectId'] === null));
    }

    /**
     * Existing projects the import changes.
     *
     * @return list<array{key: string, line: int, name: string, client: string|null, projectId: int|null, archived: bool, private: bool, estimateSeconds: int|null, note: string|null, billable: bool, members: list<string>, newMemberIds: list<int>, changes: list<string>}>
     */
    public function changedProjects(): array
    {
        return array_values(array_filter($this->projects, fn (array $project) => $project['projectId'] !== null && $project['changes'] !== []));
    }

    /**
     * @param  array<string, bool>  $billableByProject
     */
    private function build(array $billableByProject): void
    {
        $existingProjects = $this->existingProjects();
        $existingClients = Client::query()->forOrganization($this->organization)->get()
            ->keyBy(fn (Client $client) => ClockifyImportPlan::normalize($client->name));
        $membersByName = $this->organization->members()->wherePivotNull('deactivated_at')->get()
            ->groupBy(fn (User $user) => ClockifyImportPlan::normalize($user->name));
        $unknown = [];
        $newClients = [];

        foreach ($this->csv->rows as $row) {
            $key = ClockifyImportPlan::projectKey($row->client, $row->name);

            // The first row wins when a project is listed twice.
            if (array_any($this->projects, fn (array $project) => $project['key'] === $key)) {
                continue;
            }

            $members = [];

            foreach ($row->memberNames as $name) {
                $matches = $membersByName->get(ClockifyImportPlan::normalize($name));

                if ($matches === null || $matches->count() !== 1) {
                    $unknown[$name] = true;

                    continue;
                }

                $members[] = $matches->sole();
            }

            $existing = $existingProjects->get($key);
            $note = $row->note === null ? null : mb_substr($row->note, 0, self::MAX_NOTE_LENGTH);
            $assigned = $existing?->members->modelKeys() ?? [];
            $newMemberIds = array_values(array_diff(array_map(fn (User $user) => $user->id, $members), $assigned));

            $changes = $existing === null ? [] : array_keys(array_filter([
                'archive' => $row->archived && ! $existing->isArchived(),
                'private' => $row->private && $existing->visibility === ProjectVisibility::Public,
                'note' => $note !== null && trim((string) $existing->notes) === '',
                'estimate' => $row->estimateSeconds !== null && $existing->estimate_seconds === null,
                'members' => $newMemberIds !== [],
            ]));

            if ($existing === null && $row->client !== null && ! $existingClients->has(ClockifyImportPlan::normalize($row->client))) {
                $newClients[ClockifyImportPlan::normalize($row->client)] ??= mb_substr(ClockifyImportPlan::clean($row->client), 0, 255);
            }

            $this->projects[] = [
                'key' => $key,
                'line' => $row->line,
                'name' => $existing->name ?? mb_substr(ClockifyImportPlan::clean($row->name), 0, 255),
                'client' => $existing?->client->name ?? ($row->client === null ? null : mb_substr(ClockifyImportPlan::clean($row->client), 0, 255)),
                'projectId' => $existing?->id,
                'archived' => $row->archived,
                'private' => $row->private,
                'estimateSeconds' => $row->estimateSeconds,
                'note' => $note,
                'billable' => $existing->is_billable ?? ($billableByProject[$key] ?? true),
                'members' => array_map(fn (User $user) => $user->name, $members),
                'newMemberIds' => $newMemberIds,
                'changes' => $changes,
            ];
        }

        $this->newClients = array_values($newClients);
        $this->unknownMembers = array_keys($unknown);
    }

    /**
     * The organization's projects by match key, preferring active ones when names repeat.
     *
     * @return Collection<string, Project>
     */
    private function existingProjects(): Collection
    {
        $projects = [];

        $query = Project::query()
            ->forOrganization($this->organization)
            ->with(['client', 'members:users.id'])
            ->orderByRaw('CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END')
            ->orderBy('id');

        foreach ($query->get() as $project) {
            $projects[ClockifyImportPlan::projectKey($project->client?->name, $project->name)] ??= $project;
        }

        return collect($projects);
    }
}
