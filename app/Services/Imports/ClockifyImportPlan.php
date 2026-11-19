<?php

namespace App\Services\Imports;

use App\Data\ClockifyRow;
use App\Models\Client;
use App\Models\Organization;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * What an import of a Clockify export into an organization would do: how its users map to members,
 * which clients and projects exist or would be created, and which rows are imported or skipped
 * (and why). The preview shows it; ImportClockifyEntries carries it out.
 *
 * Times in the file are read in the importing user's time zone. Projects match on client and
 * project name (case-insensitive); users match active members on email unless mapped by hand.
 */
final class ClockifyImportPlan
{
    /**
     * @var array<int, array{email: string, name: string, entries: int, seconds: int, memberId: int|null, matched: bool}>
     */
    public array $members = [];

    /**
     * @var array<int, array{key: string, name: string, client: string|null, projectId: int|null, isArchived: bool, billable: bool, entries: int, seconds: int}>
     */
    public array $projects = [];

    /** @var array<int, string> */
    public array $newClients = [];

    /**
     * @var array<int, array{line: int, date: string|null, user: string|null, project: string|null, reason: string}>
     */
    public array $skipped = [];

    /**
     * @var array<int, array{row: ClockifyRow, userId: int, projectKey: string, startedAt: CarbonImmutable, endedAt: CarbonImmutable}>
     */
    public array $entries = [];

    public ?string $from = null;

    public ?string $to = null;

    /**
     * @param  array<string, int|null>  $memberMap  email => member id (null skips the user); missing emails match on email
     * @param  array<string, bool>  $billableByProject  project key => billable, for new projects
     */
    public function __construct(
        public readonly Organization $organization,
        public readonly User $importer,
        public readonly ClockifyCsv $csv,
        array $memberMap = [],
        array $billableByProject = [],
    ) {
        $this->build($memberMap, $billableByProject);
    }

    public function timezone(): string
    {
        return $this->importer->timezone;
    }

    /**
     * The key a project is matched on: client and project name, normalized.
     */
    public static function projectKey(?string $client, string $project): string
    {
        return self::normalize($client ?? '').'|'.self::normalize($project);
    }

    public static function normalize(string $name): string
    {
        return mb_strtolower(self::clean($name));
    }

    public static function clean(string $name): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $name));
    }

    public function importableSeconds(): int
    {
        return array_sum(array_map(fn (array $entry) => (int) $entry['startedAt']->diffInSeconds($entry['endedAt']), $this->entries));
    }

    /**
     * @param  array<string, int|null>  $memberMap
     * @param  array<string, bool>  $billableByProject
     */
    private function build(array $memberMap, array $billableByProject): void
    {
        $timezone = $this->timezone();
        $activeMembers = $this->organization->members()->wherePivotNull('deactivated_at')->get();
        $membersByEmail = $activeMembers->keyBy(fn (User $user) => mb_strtolower($user->email));
        $membersById = $activeMembers->keyBy('id');

        $existingProjects = $this->existingProjects();
        $existingClients = Client::query()->forOrganization($this->organization)->get()
            ->keyBy(fn (Client $client) => self::normalize($client->name));

        foreach ($this->csv->errors as $error) {
            $this->skip($error['line'], null, null, null, $error['message']);
        }

        // Users and projects in the file, in order of appearance.
        $members = [];
        $projects = [];

        foreach ($this->csv->rows as $row) {
            if (! isset($members[$row->email])) {
                $mapped = array_key_exists($row->email, $memberMap) ? $memberMap[$row->email] : $membersByEmail->get($row->email)?->id;

                $members[$row->email] = [
                    'email' => $row->email,
                    'name' => $row->userName,
                    'entries' => 0,
                    'seconds' => 0,
                    'memberId' => $mapped !== null && $membersById->has($mapped) ? $mapped : null,
                    'matched' => $membersByEmail->has($row->email),
                ];
            }

            if ($row->project === null) {
                continue;
            }

            $key = self::projectKey($row->client, $row->project);

            if (! isset($projects[$key])) {
                $existing = $existingProjects->get($key);

                $projects[$key] = [
                    'key' => $key,
                    'name' => $existing->name ?? mb_substr(self::clean($row->project), 0, 255),
                    'client' => $existing?->client->name ?? ($row->client === null ? null : mb_substr(self::clean($row->client), 0, 255)),
                    'projectId' => $existing?->id,
                    'isArchived' => $existing !== null && ($existing->isArchived() || $existing->client?->isArchived()),
                    'billable' => $existing->is_billable ?? ($billableByProject[$key] ?? true),
                    'entries' => 0,
                    'seconds' => 0,
                ];
            }
        }

        $existingKeys = $this->existingEntryKeys($timezone);
        $seen = [];
        $accessible = [];

        foreach ($this->csv->rows as $row) {
            $startedAt = CarbonImmutable::parse($row->start, $timezone);
            $endedAt = CarbonImmutable::parse($row->end, $timezone);
            $seconds = max(0, (int) $startedAt->diffInSeconds($endedAt, false));
            $member = &$members[$row->email];
            $member['entries']++;
            $member['seconds'] += $seconds;

            $this->from = min($this->from ?? $startedAt->toDateString(), $startedAt->toDateString());
            $this->to = max($this->to ?? $startedAt->toDateString(), $startedAt->toDateString());
            $date = $startedAt->toDateString();

            if ($row->project === null) {
                $this->skip($row->line, $date, $row->userName, null, __('The entry has no project.'));

                continue;
            }

            $key = self::projectKey($row->client, $row->project);
            $project = &$projects[$key];
            $project['entries']++;
            $project['seconds'] += $seconds;
            $skip = fn (string $reason) => $this->skip($row->line, $date, $row->userName, $row->project, $reason);

            if ($endedAt->lessThanOrEqualTo($startedAt)) {
                $skip(__('The end time must be after the start time.'));

                continue;
            }

            if ($seconds > TimeEntry::MAX_DURATION_SECONDS) {
                $skip(__('The entry is longer than 24 hours (:hours h).', ['hours' => round($seconds / 3600, 2)]));

                continue;
            }

            if ($member['memberId'] === null) {
                $skip(__('No member chosen for :email.', ['email' => $row->email]));

                continue;
            }

            if ($project['isArchived']) {
                $skip(__('The project is archived.'));

                continue;
            }

            $userId = $member['memberId'];

            if ($project['projectId'] !== null) {
                $pair = $project['projectId'].'|'.$userId;
                $existingProject = $existingProjects->get($key);
                $user = $membersById->get($userId);
                $accessible[$pair] ??= $existingProject !== null && $user !== null && $existingProject->isAccessibleBy($user);

                if (! $accessible[$pair]) {
                    $skip(__(':name is not assigned to this project.', ['name' => $user->name ?? $row->userName]));

                    continue;
                }
            }

            $entryKey = $userId.'|'.$key.'|'.$startedAt->utc()->toIso8601String().'|'.$endedAt->utc()->toIso8601String();

            if (isset($seen[$entryKey])) {
                $skip(__('The entry appears twice in the file.'));

                continue;
            }

            $seen[$entryKey] = true;

            if ($project['projectId'] !== null && isset($existingKeys[$userId.'|'.$project['projectId'].'|'.$startedAt->utc()->toIso8601String().'|'.$endedAt->utc()->toIso8601String()])) {
                $skip(__('The entry already exists.'));

                continue;
            }

            $this->entries[] = [
                'row' => $row,
                'userId' => $userId,
                'projectKey' => $key,
                'startedAt' => $startedAt,
                'endedAt' => $endedAt,
            ];
        }

        unset($member, $project);

        // Only clients of projects that will be created and receive time.
        $usedKeys = array_flip(array_map(fn (array $entry) => $entry['projectKey'], $this->entries));
        $this->newClients = array_values(array_unique(array_filter(array_map(
            fn (array $project) => $project['projectId'] === null && isset($usedKeys[$project['key']]) && $project['client'] !== null && ! $existingClients->has(self::normalize($project['client']))
                ? $project['client']
                : null,
            $projects,
        ))));

        $this->members = array_values($members);
        $this->projects = array_values($projects);
        usort($this->skipped, fn (array $a, array $b) => $a['line'] <=> $b['line']);
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
            ->with(['client', 'organization'])
            ->orderByRaw('CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END')
            ->orderBy('id');

        foreach ($query->get() as $project) {
            $projects[self::projectKey($project->client?->name, $project->name)] ??= $project;
        }

        return collect($projects);
    }

    /**
     * Existing entries in the file's period ("user|project|start|end" in UTC), to skip duplicates when
     * the same export is imported twice.
     *
     * @return array<string, true>
     */
    private function existingEntryKeys(string $timezone): array
    {
        $starts = array_map(fn (ClockifyRow $row) => CarbonImmutable::parse($row->start, $timezone)->utc(), $this->csv->rows);

        if ($starts === []) {
            return [];
        }

        $keys = [];

        TimeEntry::query()
            ->forOrganization($this->organization)
            ->whereBetween('started_at', [min($starts), max($starts)])
            ->get(['user_id', 'project_id', 'started_at', 'ended_at'])
            ->each(function (TimeEntry $entry) use (&$keys) {
                $keys[$entry->user_id.'|'.$entry->project_id.'|'.$entry->started_at->utc()->toIso8601String().'|'.$entry->ended_at->utc()->toIso8601String()] = true;
            });

        return $keys;
    }

    private function skip(int $line, ?string $date, ?string $user, ?string $project, string $reason): void
    {
        $this->skipped[] = ['line' => $line, 'date' => $date, 'user' => $user, 'project' => $project, 'reason' => $reason];
    }
}
