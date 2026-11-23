<?php

namespace App\Services\Imports;

use App\Data\ClockifyRow;
use App\Enums\OrganizationRole;
use App\Enums\ProjectVisibility;
use App\Enums\TimeEntrySource;
use App\Models\Client;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use App\Support\RateResolver;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * What an import of a Clockify export into an organization would do: how its users map to members,
 * which clients and projects exist or would be created, and which rows are imported or skipped
 * (and why). The preview shows it; ImportClockifyEntries carries it out.
 *
 * Times in the file are read in the importing user's time zone. Projects match on client and
 * project name (case-insensitive); users match active members on email unless mapped by hand.
 * People with a pending invitation can get time too (they match on the invited email): they are
 * planned with invitationMemberId() as a stand-in id, and the import adds them as members first.
 *
 * Archived projects get time too, since old history mostly belongs to them. Rows without a project
 * are skipped unless a project is chosen for them.
 *
 * Rows longer than 24 hours (e.g. a week's time logged as one entry) are split at midnight in the
 * importer's time zone, keeping Clockify's start and end, since an entry is at most 24 hours.
 *
 * Every member with time on a project gets an hourly rate: the one chosen in the preview, else the
 * one the rate order gives. Rows that an earlier import already created are listed separately, so
 * their rate and billable setting can be updated instead of importing them again.
 */
final class ClockifyImportPlan
{
    /**
     * @var array<int, array{email: string, name: string, entries: int, seconds: int, memberId: int|null, matched: bool}>
     */
    public array $members = [];

    /**
     * Pending invitations of people who aren't members yet, by stand-in member id (see
     * invitationMemberId()), with the name the account gets (from the file, else the email).
     *
     * @var array<int, array{invitation: OrganizationInvitation, name: string}>
     */
    public array $invitations = [];

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

    /**
     * Rows an earlier import created (same member, project and times), which can be updated.
     *
     * @var array<int, array{entryId: int, row: ClockifyRow, userId: int, projectKey: string, seconds: int}>
     */
    public array $alreadyImported = [];

    /** Rows longer than 24 hours, split at midnight into one entry per day. */
    public int $splitRows = 0;

    /** Rows without a project: skipped, or put on the project chosen for them. */
    public int $rowsWithoutProject = 0;

    /**
     * Hourly rate (minor units) per member and project, for the entries above and the already
     * imported ones. "defaultRate" is what the rate order gives; "rate" is the one that applies.
     *
     * @var array<int, array{projectKey: string, userId: int, name: string, avatar: string|null, entries: int, seconds: int, defaultRate: int|null, rate: int|null}>
     */
    public array $rates = [];

    public ?string $from = null;

    public ?string $to = null;

    /**
     * @param  array<string, int|null>  $memberMap  email => member id (null skips the user); missing emails match on email
     * @param  array<string, bool>  $billableByProject  project key => billable, for new projects
     * @param  array<string, int|null>  $chosenRates  rateKey() => hourly rate in minor units (null uses the rate order)
     * @param  int|null  $projectForRowsWithoutProject  an existing project that rows without a project go to (null skips them)
     */
    public function __construct(
        public readonly Organization $organization,
        public readonly User $importer,
        public readonly ClockifyCsv $csv,
        array $memberMap = [],
        array $billableByProject = [],
        array $chosenRates = [],
        public readonly ?int $projectForRowsWithoutProject = null,
    ) {
        $this->build($memberMap, $billableByProject);
        $this->buildRates($chosenRates);
    }

    /**
     * The stand-in member id of a pending invitation: negative, so it never collides with a user id.
     */
    public static function invitationMemberId(int $invitationId): int
    {
        return -$invitationId;
    }

    /**
     * Invitations whose person gets imported time, by stand-in member id: the import adds them as
     * members before creating the entries.
     *
     * @return array<int, array{invitation: OrganizationInvitation, name: string}>
     */
    public function invitationsWithTime(): array
    {
        $memberIds = array_flip(array_column($this->entries, 'userId'));

        return array_filter($this->invitations, fn (int $memberId) => isset($memberIds[$memberId]), ARRAY_FILTER_USE_KEY);
    }

    /**
     * The key a chosen rate is sent with: project match key and member id.
     */
    public static function rateKey(string $projectKey, int $userId): string
    {
        return $projectKey.'|'.$userId;
    }

    /**
     * Rates that differ from the rate order, for billable projects: they are saved as the member's
     * rate on the project, so time reported later gets the same rate.
     *
     * @return array<int, array{projectKey: string, userId: int, rate: int}>
     */
    public function changedRates(): array
    {
        $billable = array_column($this->projects, 'billable', 'key');
        $changed = [];

        foreach ($this->rates as $rate) {
            if ($rate['rate'] !== null && $rate['rate'] !== $rate['defaultRate'] && ($billable[$rate['projectKey']] ?? false)) {
                $changed[] = ['projectKey' => $rate['projectKey'], 'userId' => $rate['userId'], 'rate' => $rate['rate']];
            }
        }

        return $changed;
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
        // Base collections: an Eloquent collection would merge on the models' ids.
        $membersByEmail = $activeMembers->keyBy(fn (User $user) => mb_strtolower($user->email))->toBase();
        $membersById = $activeMembers->keyBy('id')->toBase();

        // Invited people who aren't members yet, as unsaved users with a stand-in id.
        $invitationsByEmail = [];

        foreach (OrganizationInvitation::query()->where('organization_id', $this->organization->id)->pending()->with('organization')->orderBy('id')->get() as $invitation) {
            $email = mb_strtolower(trim($invitation->email));

            if ($membersByEmail->has($email) || isset($invitationsByEmail[$email])) {
                continue;
            }

            $standIn = new User(['name' => $email, 'email' => $email]);
            $standIn->id = self::invitationMemberId($invitation->id);
            $invitationsByEmail[$email] = $standIn;
            $this->invitations[$standIn->id] = ['invitation' => $invitation, 'name' => $email];
        }

        $membersByEmail = $membersByEmail->merge($invitationsByEmail);
        $membersById = $membersById->union(collect($invitationsByEmail)->keyBy('id'));

        $existingProjects = $this->existingProjects();
        $existingClients = Client::query()->forOrganization($this->organization)->get()
            ->keyBy(fn (Client $client) => self::normalize($client->name));

        foreach ($this->csv->errors as $error) {
            $this->skip($error['line'], null, null, null, $error['message']);
        }

        // Rows without a project go to the chosen project, if any.
        $fallback = $this->projectForRowsWithoutProject === null ? null
            : Project::query()->forOrganization($this->organization)->with('client')->find($this->projectForRowsWithoutProject);
        $projectOf = fn (ClockifyRow $row): ?array => $row->project !== null
            ? ['client' => $row->client, 'name' => $row->project]
            : ($fallback === null ? null : ['client' => $fallback->client?->name, 'name' => $fallback->name]);

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

                // An invited person's account gets the name from the file.
                $memberId = $members[$row->email]['memberId'];

                if ($memberId !== null && isset($this->invitations[$memberId]) && $this->invitations[$memberId]['name'] === mb_strtolower(trim($this->invitations[$memberId]['invitation']->email))) {
                    $this->invitations[$memberId]['name'] = $row->userName;
                    $membersById->get($memberId)?->setAttribute('name', $row->userName);
                }
            }

            $reference = $projectOf($row);

            if ($reference === null) {
                continue;
            }

            $key = self::projectKey($reference['client'], $reference['name']);

            if (! isset($projects[$key])) {
                $existing = $existingProjects->get($key);

                $projects[$key] = [
                    'key' => $key,
                    'name' => $existing->name ?? mb_substr(self::clean($reference['name']), 0, 255),
                    'client' => $existing?->client->name ?? ($reference['client'] === null ? null : mb_substr(self::clean($reference['client']), 0, 255)),
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
                $this->rowsWithoutProject++;
            }

            $reference = $projectOf($row);

            if ($reference === null) {
                $this->skip($row->line, $date, $row->userName, null, __('The entry has no project.'));

                continue;
            }

            $key = self::projectKey($reference['client'], $reference['name']);
            $project = &$projects[$key];
            $project['entries']++;
            $project['seconds'] += $seconds;
            $skip = fn (string $reason) => $this->skip($row->line, $date, $row->userName, $reference['name'], $reason);

            if ($endedAt->lessThanOrEqualTo($startedAt)) {
                $skip(__('The end time must be after the start time.'));

                continue;
            }

            if ($member['memberId'] === null) {
                $skip(__('No member chosen for :email.', ['email' => $row->email]));

                continue;
            }

            $userId = $member['memberId'];

            if ($project['projectId'] !== null) {
                $pair = $project['projectId'].'|'.$userId;
                $existingProject = $existingProjects->get($key);
                $user = $membersById->get($userId);
                $accessible[$pair] ??= $existingProject !== null && $user !== null && $this->canReportOn($existingProject, $user);

                if (! $accessible[$pair]) {
                    $skip(__(':name is not assigned to this project.', ['name' => $user->name ?? $row->userName]));

                    continue;
                }
            }

            $segments = $seconds > TimeEntry::MAX_DURATION_SECONDS ? self::splitAtMidnight($startedAt, $endedAt) : [[$startedAt, $endedAt]];

            if (count($segments) > 1) {
                $this->splitRows++;
            }

            foreach ($segments as [$segmentStart, $segmentEnd]) {
                $times = $segmentStart->utc()->toIso8601String().'|'.$segmentEnd->utc()->toIso8601String();
                $entryKey = $userId.'|'.$key.'|'.$times;

                if (isset($seen[$entryKey])) {
                    $skip(__('The entry appears twice in the file.'));

                    continue;
                }

                $seen[$entryKey] = true;

                $existing = $project['projectId'] === null ? null : ($existingKeys[$userId.'|'.$project['projectId'].'|'.$times] ?? null);

                if ($existing !== null && $existing['imported']) {
                    $this->alreadyImported[] = ['entryId' => $existing['id'], 'row' => $row, 'userId' => $userId, 'projectKey' => $key, 'seconds' => (int) $segmentStart->diffInSeconds($segmentEnd)];

                    continue;
                }

                if ($existing !== null) {
                    $skip(__('The entry already exists.'));

                    continue;
                }

                $this->entries[] = [
                    'row' => $row,
                    'userId' => $userId,
                    'projectKey' => $key,
                    'startedAt' => $segmentStart,
                    'endedAt' => $segmentEnd,
                ];
            }
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
     * The rate per member and project for the importable and already imported rows.
     *
     * @param  array<string, int|null>  $chosenRates
     */
    private function buildRates(array $chosenRates): void
    {
        $pairs = [];

        foreach ($this->entries as $entry) {
            $pairs[self::rateKey($entry['projectKey'], $entry['userId'])][] = (int) $entry['startedAt']->diffInSeconds($entry['endedAt']);
        }

        foreach ($this->alreadyImported as $entry) {
            $pairs[self::rateKey($entry['projectKey'], $entry['userId'])][] = $entry['seconds'];
        }

        if ($pairs === []) {
            return;
        }

        $resolver = app(RateResolver::class);
        $existingProjects = Project::query()
            ->forOrganization($this->organization)
            ->whereIn('id', array_filter(array_column($this->projects, 'projectId')))
            ->with('organization')
            ->get()
            ->keyBy('id');
        $users = $this->organization->members()
            ->whereIn('users.id', array_unique(array_merge(array_column($this->entries, 'userId'), array_column($this->alreadyImported, 'userId'))))
            ->get()
            ->concat($this->invitedUsers())
            ->sortBy('name')
            ->keyBy('id');

        foreach ($this->projects as $project) {
            foreach ($users as $user) {
                $rateKey = self::rateKey($project['key'], $user->id);

                if (! isset($pairs[$rateKey])) {
                    continue;
                }

                $existing = $project['projectId'] === null ? null : $existingProjects->get($project['projectId']);
                $defaultRate = $existing !== null ? $resolver->resolve($existing, $user) : $resolver->forMember($this->organization, $user);

                $this->rates[] = [
                    'projectKey' => $project['key'],
                    'userId' => $user->id,
                    'name' => $user->name,
                    'avatar' => $user->avatar,
                    'entries' => count($pairs[$rateKey]),
                    'seconds' => array_sum($pairs[$rateKey]),
                    'defaultRate' => $defaultRate,
                    'rate' => $chosenRates[$rateKey] ?? $defaultRate,
                ];
            }
        }
    }

    /**
     * Split a long period at each midnight (in the period's time zone), so every part is within one
     * day. A part never exceeds 24 hours, also on the day clocks go back.
     *
     * @return array<int, array{0: CarbonImmutable, 1: CarbonImmutable}>
     */
    private static function splitAtMidnight(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $segments = [];
        $cursor = $start;

        while ($cursor->lessThan($end)) {
            $segmentEnd = $cursor->addDay()->startOfDay();
            $limit = $cursor->addSeconds(TimeEntry::MAX_DURATION_SECONDS);

            if ($limit->lessThan($segmentEnd)) {
                $segmentEnd = $limit;
            }

            if ($end->lessThan($segmentEnd)) {
                $segmentEnd = $end;
            }

            $segments[] = [$cursor, $segmentEnd];
            $cursor = $segmentEnd;
        }

        return $segments;
    }

    /**
     * Whether the user may report time on the existing project. An invited person isn't a member yet,
     * so their invitation's role decides: admins see every project, others only public ones.
     */
    private function canReportOn(Project $project, User $user): bool
    {
        $invitation = $this->invitations[$user->id]['invitation'] ?? null;

        if ($invitation === null) {
            return $project->isAccessibleBy($user);
        }

        return $invitation->role->isAtLeast(OrganizationRole::Admin) || $project->visibility === ProjectVisibility::Public;
    }

    /**
     * Unsaved stand-in users for the invited people with time, for their rates.
     *
     * @return array<int, User>
     */
    private function invitedUsers(): array
    {
        $users = [];

        foreach ($this->invitationsWithTime() as $memberId => $item) {
            $user = new User(['name' => $item['name'], 'email' => mb_strtolower($item['invitation']->email)]);
            $user->id = $memberId;
            $users[] = $user;
        }

        return $users;
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
     * Existing entries in the file's period by "user|project|start|end" (UTC), to recognize rows that
     * are already there when the same export is imported twice. An entry from an import wins over
     * one reported in the app at the same time.
     *
     * @return array<string, array{id: int, imported: bool}>
     */
    private function existingEntryKeys(string $timezone): array
    {
        $starts = array_map(fn (ClockifyRow $row) => CarbonImmutable::parse($row->start, $timezone)->utc(), $this->csv->rows);
        // Parts of a split row start as late as the row ends.
        $ends = array_map(fn (ClockifyRow $row) => CarbonImmutable::parse($row->end, $timezone)->utc(), $this->csv->rows);

        if ($starts === []) {
            return [];
        }

        $keys = [];

        TimeEntry::query()
            ->forOrganization($this->organization)
            ->whereBetween('started_at', [min($starts), max([...$starts, ...$ends])])
            ->orderBy('id')
            ->get(['id', 'user_id', 'project_id', 'started_at', 'ended_at', 'source'])
            ->each(function (TimeEntry $entry) use (&$keys) {
                $key = $entry->user_id.'|'.$entry->project_id.'|'.$entry->started_at->utc()->toIso8601String().'|'.$entry->ended_at->utc()->toIso8601String();
                $imported = $entry->source === TimeEntrySource::Import;

                if (! isset($keys[$key]) || ($imported && ! $keys[$key]['imported'])) {
                    $keys[$key] = ['id' => $entry->id, 'imported' => $imported];
                }
            });

        return $keys;
    }

    private function skip(int $line, ?string $date, ?string $user, ?string $project, string $reason): void
    {
        $this->skipped[] = ['line' => $line, 'date' => $date, 'user' => $user, 'project' => $project, 'reason' => $reason];
    }
}
