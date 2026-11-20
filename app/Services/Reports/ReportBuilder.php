<?php

namespace App\Services\Reports;

use App\Enums\ReportGrouping;
use App\Models\Organization;
use App\Models\Project;
use App\Models\Tag;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Turns report filters and groupings into aggregated results. Used by the report pages, exports and
 * (later) the MCP `get_report` tool.
 *
 * Entries count towards the local day (viewer's time zone) they start on. Bucketing by day, week and
 * month is done in PHP so the SQL stays database-agnostic. Amounts are billable time × the rate
 * snapshotted on each entry, rounded per entry, and null for viewers without ViewRates.
 *
 * @phpstan-type ReportTotals array{seconds: int, billableSeconds: int, amount: int|null}
 * @phpstan-type ReportSubGroup array{key: string, label: string, color: string|null, seconds: int, billableSeconds: int, amount: int|null, children: array<int, mixed>}
 * @phpstan-type ReportGroup array{key: string, label: string, color: string|null, seconds: int, billableSeconds: int, amount: int|null, children: array<int, ReportSubGroup>}
 * @phpstan-type TimelineBucket array{key: string, seconds: int, billableSeconds: int, projectSeconds?: array<int, int>}
 * @phpstan-type TimelineProject array{id: int, name: string, clientName: string|null, color: string}
 * @phpstan-type Timeline array{unit: string, buckets: array<int, TimelineBucket>, projects?: list<TimelineProject>}
 * @phpstan-type ProjectShare array{id: int|null, name: string, color: string|null, clientName: string|null, seconds: int}
 */
class ReportBuilder
{
    /** Longest period (in days) shown per day in the timeline; longer periods are shown per week. */
    public const int MAX_DAILY_BUCKETS = 31;

    /** Projects shown in the distribution before the rest is folded into "Other". */
    public const int MAX_PROJECT_SHARES = 8;

    /**
     * Entries the filters cover, scoped to the organization and to the viewer's own time unless they
     * may see the team's.
     *
     * @return Builder<TimeEntry>
     */
    public function query(ReportFilters $filters): Builder
    {
        $organization = $filters->organization;

        return TimeEntry::query()
            ->forOrganization($organization)
            ->when(
                $filters->canViewTeam(),
                fn (Builder $query) => $query->when($filters->userIds !== [], fn (Builder $query) => $query->whereIn('user_id', $filters->userIds)),
                fn (Builder $query) => $query->where('user_id', $filters->viewer->id),
            )
            ->when($filters->projectIds !== [], fn (Builder $query) => $query->whereIn('project_id', $filters->projectIds))
            ->when($filters->clientIds !== [], fn (Builder $query) => $query->whereIn(
                'project_id',
                Project::query()->forOrganization($organization)->whereIn('client_id', $filters->clientIds)->select('id'),
            ))
            ->when($filters->billable !== null, fn (Builder $query) => $query->where('is_billable', $filters->billable))
            // Through the pivot: entries are already limited to the organization, and so are their tags.
            ->when($filters->tagIds !== [], fn (Builder $query) => $query->whereIn(
                'id',
                DB::table('tag_time_entry')->whereIn('tag_id', $filters->tagIds)->select('time_entry_id'),
            ))
            ->when($filters->startsAt(), fn (Builder $query, CarbonImmutable $at) => $query->where('started_at', '>=', $at))
            ->when($filters->endsBefore(), fn (Builder $query, CarbonImmutable $at) => $query->where('started_at', '<', $at));
    }

    /**
     * Totals, up to two levels of groups, a timeline (per day, or per week for long periods) and the
     * distribution per project.
     *
     * @return array{totals: ReportTotals, groups: array<int, ReportGroup>, timeline: Timeline, projects: array<int, ProjectShare>}
     */
    public function summary(
        ReportFilters $filters,
        ReportGrouping $grouping,
        ?ReportGrouping $subGrouping = null,
        bool $includeTimelineProjects = false,
    ): array {
        $usesTags = in_array(ReportGrouping::Tag, [$grouping, $subGrouping], true);
        $entries = $this->query($filters)
            ->with(['project:id,name,color,client_id', 'project.client:id,name', 'user:id,name', ...($usesTags ? ['tags:id,name'] : [])])
            ->get(['id', 'user_id', 'project_id', 'started_at', 'duration_seconds', 'is_billable', 'hourly_rate']);

        return [
            'totals' => $this->totals($entries, $filters),
            'groups' => $this->group($entries, $filters, $grouping, $subGrouping === $grouping ? null : $subGrouping),
            'timeline' => $this->timeline($entries, $filters, $includeTimelineProjects),
            'projects' => $this->projectShares($entries, $filters),
        ];
    }

    /**
     * @return ReportTotals
     */
    public function totalsFor(ReportFilters $filters): array
    {
        return $this->totals(
            $this->query($filters)->get(['id', 'duration_seconds', 'is_billable', 'hourly_rate']),
            $filters,
        );
    }

    /**
     * Single entries for the detailed report.
     *
     * @param  'date'|'duration'|'project'|'member'  $sort
     * @param  'asc'|'desc'  $direction
     * @return LengthAwarePaginator<int, TimeEntry>
     */
    public function detailed(ReportFilters $filters, string $sort = 'date', string $direction = 'desc', int $perPage = 50): LengthAwarePaginator
    {
        return $this->sorted($this->query($filters), $sort, $direction)
            ->with(['project.client', 'user:id,name', 'tags:id,name'])
            ->paginate($perPage)
            ->withQueryString();
    }

    /**
     * All entries for the detailed export, in report order.
     *
     * @param  'date'|'duration'|'project'|'member'  $sort
     * @param  'asc'|'desc'  $direction
     * @return iterable<int, TimeEntry>
     */
    public function detailedForExport(ReportFilters $filters, string $sort = 'date', string $direction = 'desc'): iterable
    {
        return $this->sorted($this->query($filters), $sort, $direction)
            ->with(['project.client', 'user:id,name', 'tags:id,name'])
            ->lazy(500);
    }

    /**
     * A detailed report row: the entry as on the time pages plus member, rate and amount.
     *
     * @return array{id: int, userId: int, memberName: string, project: array{id: int, name: string, code: string|null, color: string, clientName: string|null}, description: string|null, tags: array<int, string>, date: string, start: string, end: string, durationSeconds: int, isBillable: bool, hourlyRate: int|null, amount: int|null}
     */
    public function row(TimeEntry $entry, ReportFilters $filters): array
    {
        $start = $entry->started_at->setTimezone($filters->timezone());
        $end = $entry->ended_at->setTimezone($filters->timezone());
        $canViewAmounts = $filters->canViewAmounts();

        return [
            'id' => $entry->id,
            'userId' => $entry->user_id,
            'memberName' => $entry->user->name,
            'project' => [
                'id' => $entry->project->id,
                'name' => $entry->project->name,
                'code' => $entry->project->code,
                'color' => $entry->project->color,
                'clientName' => $entry->project->client?->name,
            ],
            'description' => $entry->description,
            'tags' => $entry->tagNames(),
            'date' => $start->toDateString(),
            'start' => $start->format('Y-m-d\TH:i'),
            'end' => $end->format('Y-m-d\TH:i'),
            'durationSeconds' => $entry->duration_seconds,
            'isBillable' => $entry->is_billable,
            'hourlyRate' => $canViewAmounts ? $entry->hourly_rate : null,
            'amount' => $canViewAmounts ? $this->amount($entry) : null,
        ];
    }

    /**
     * Active projects the viewer can access with their estimate and all time reported on them.
     *
     * @return array<int, array{id: int, name: string, code: string|null, color: string, clientName: string|null, estimateSeconds: int|null, consumedSeconds: int, billableSeconds: int, remainingSeconds: int|null, percent: int|null}>
     */
    public function projectFollowUp(Organization $organization, User $viewer): array
    {
        return Project::query()
            ->forOrganization($organization)
            ->accessibleBy($viewer, $organization)
            ->active()
            ->with('client:id,name')
            ->withSum('timeEntries as consumed_seconds', 'duration_seconds')
            ->withSum(['timeEntries as billable_seconds' => fn (Builder $query) => $query->where('is_billable', true)], 'duration_seconds')
            ->orderBy('name')
            ->get()
            ->map(function (Project $project): array {
                $consumed = $this->integer($project->getAttribute('consumed_seconds'));
                $estimate = $project->estimate_seconds;

                return [
                    'id' => $project->id,
                    'name' => $project->name,
                    'code' => $project->code,
                    'color' => $project->color,
                    'clientName' => $project->client?->name,
                    'estimateSeconds' => $estimate,
                    'consumedSeconds' => $consumed,
                    'billableSeconds' => $this->integer($project->getAttribute('billable_seconds')),
                    'remainingSeconds' => $estimate !== null ? $estimate - $consumed : null,
                    'percent' => $estimate ? (int) round($consumed / $estimate * 100) : null,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, TimeEntry>  $entries
     * @return ReportTotals
     */
    private function totals(Collection $entries, ReportFilters $filters): array
    {
        $seconds = 0;
        $billableSeconds = 0;
        $amount = 0;

        foreach ($entries as $entry) {
            $seconds += $entry->duration_seconds;

            if ($entry->is_billable) {
                $billableSeconds += $entry->duration_seconds;
                $amount += $this->amount($entry);
            }
        }

        return [
            'seconds' => $seconds,
            'billableSeconds' => $billableSeconds,
            'amount' => $filters->canViewAmounts() ? $amount : null,
        ];
    }

    private function amount(TimeEntry $entry): int
    {
        if (! $entry->is_billable || $entry->hourly_rate === null) {
            return 0;
        }

        return (int) round($entry->duration_seconds * $entry->hourly_rate / 3600);
    }

    /**
     * @param  Collection<int, TimeEntry>  $entries
     * @return array<int, ReportGroup>
     */
    private function group(Collection $entries, ReportFilters $filters, ReportGrouping $grouping, ?ReportGrouping $subGrouping): array
    {
        $groups = [];

        foreach ($this->buckets($entries, $grouping, $filters) as $key => $bucket) {
            $items = $bucket['entries'];

            $groups[] = [
                'key' => (string) $key,
                'label' => $bucket['label'],
                'color' => $bucket['color'],
                ...$this->totals($items, $filters),
                'children' => $subGrouping ? $this->group($items, $filters, $subGrouping, null) : [],
            ];
        }

        usort($groups, fn (array $a, array $b) => $grouping->isTime()
            ? $a['key'] <=> $b['key']
            : [$b['seconds'], mb_strtolower($a['label'])] <=> [$a['seconds'], mb_strtolower($b['label'])]);

        return $groups;
    }

    /**
     * The entries per group key. Most groupings put each entry in one group; tags put an entry in
     * each of its tags (or "No tag"), so tag groups can add up to more than the total.
     *
     * @param  Collection<int, TimeEntry>  $entries
     * @return array<string, array{label: string, color: string|null, entries: Collection<int, TimeEntry>}>
     */
    private function buckets(Collection $entries, ReportGrouping $grouping, ReportFilters $filters): array
    {
        $buckets = [];

        foreach ($entries as $entry) {
            if ($grouping === ReportGrouping::Tag) {
                $memberships = $entry->tags->isEmpty()
                    ? ['none' => __('No tag')]
                    : $entry->tags->mapWithKeys(fn (Tag $tag) => [(string) $tag->id => $tag->name])->all();
            } else {
                $key = $this->key($entry, $grouping, $filters);
                $memberships = [$key => $this->label($entry, $grouping, $key)];
            }

            foreach ($memberships as $key => $label) {
                $buckets[(string) $key] ??= [
                    'label' => (string) $label,
                    'color' => $grouping === ReportGrouping::Project ? $entry->project->color : null,
                    'entries' => new Collection,
                ];
                $buckets[(string) $key]['entries']->push($entry);
            }
        }

        return $buckets;
    }

    private function key(TimeEntry $entry, ReportGrouping $grouping, ReportFilters $filters): string
    {
        $date = $entry->started_at->setTimezone($filters->timezone());

        return match ($grouping) {
            ReportGrouping::Client => (string) ($entry->project->client_id ?? 'none'),
            ReportGrouping::Project => (string) $entry->project_id,
            ReportGrouping::Member => (string) $entry->user_id,
            // Handled per tag in buckets().
            ReportGrouping::Tag => 'none',
            ReportGrouping::Day => $date->toDateString(),
            ReportGrouping::Week => $this->weekStart($date, $filters)->toDateString(),
            ReportGrouping::Month => $date->startOfMonth()->toDateString(),
        };
    }

    private function label(TimeEntry $entry, ReportGrouping $grouping, string $key): string
    {
        return match ($grouping) {
            ReportGrouping::Client => $entry->project->client->name ?? __('No client'),
            ReportGrouping::Project => $entry->project->name,
            ReportGrouping::Member => $entry->user->name,
            ReportGrouping::Tag => __('No tag'),
            // Time buckets are formatted in the frontend from the key (a local date).
            ReportGrouping::Day, ReportGrouping::Week, ReportGrouping::Month => $key,
        };
    }

    /**
     * @param  Collection<int, TimeEntry>  $entries
     * @return Timeline
     */
    private function timeline(Collection $entries, ReportFilters $filters, bool $includeProjects): array
    {
        $timezone = $filters->timezone();
        $dates = $entries->map(fn (TimeEntry $entry) => $entry->started_at->setTimezone($timezone)->startOfDay());
        $from = $filters->from ?? $dates->min();
        $to = $filters->to ?? $dates->max();

        if (! $from instanceof CarbonImmutable || ! $to instanceof CarbonImmutable) {
            return ['unit' => 'day', 'buckets' => [], ...($includeProjects ? ['projects' => []] : [])];
        }

        $unit = $from->diffInDays($to) + 1 > self::MAX_DAILY_BUCKETS ? ReportGrouping::Week : ReportGrouping::Day;
        $cursor = $unit === ReportGrouping::Week ? $this->weekStart($from, $filters) : $from->startOfDay();
        $buckets = [];
        $projects = [];

        while ($cursor->lessThanOrEqualTo($to)) {
            $buckets[$cursor->toDateString()] = ['key' => $cursor->toDateString(), 'seconds' => 0, 'billableSeconds' => 0];
            $cursor = $unit === ReportGrouping::Week ? $cursor->addWeek() : $cursor->addDay();
        }

        foreach ($entries as $entry) {
            $key = $this->key($entry, $unit, $filters);

            if (! isset($buckets[$key])) {
                continue;
            }

            $buckets[$key]['seconds'] += $entry->duration_seconds;
            $buckets[$key]['billableSeconds'] += $entry->is_billable ? $entry->duration_seconds : 0;

            if ($includeProjects && $entry->duration_seconds > 0) {
                $project = $entry->project;
                $projects[$project->id] ??= [
                    'id' => $project->id,
                    'name' => $project->name,
                    'clientName' => $project->client?->name,
                    'color' => $project->color,
                ];
                $buckets[$key]['projectSeconds'][$project->id] = ($buckets[$key]['projectSeconds'][$project->id] ?? 0) + $entry->duration_seconds;
            }
        }

        ksort($projects);

        return [
            'unit' => $unit->value,
            'buckets' => array_values($buckets),
            ...($includeProjects ? ['projects' => array_values($projects)] : []),
        ];
    }

    /**
     * Time per project, largest first; projects beyond the first few are folded into "Other".
     *
     * @param  Collection<int, TimeEntry>  $entries
     * @return array<int, ProjectShare>
     */
    private function projectShares(Collection $entries, ReportFilters $filters): array
    {
        $shares = [];

        foreach ($entries->groupBy('project_id') as $items) {
            /** @var TimeEntry $first */
            $first = $items->first();

            $shares[] = [
                'id' => $first->project->id,
                'name' => $first->project->name,
                'color' => $first->project->color,
                'clientName' => $first->project->client?->name,
                'seconds' => $this->totals($items, $filters)['seconds'],
            ];
        }

        usort($shares, fn (array $a, array $b) => $b['seconds'] <=> $a['seconds']);

        if (count($shares) <= self::MAX_PROJECT_SHARES) {
            return $shares;
        }

        $rest = array_slice($shares, self::MAX_PROJECT_SHARES - 1);

        return [
            ...array_slice($shares, 0, self::MAX_PROJECT_SHARES - 1),
            [
                'id' => null,
                'name' => __('Other projects (:count)', ['count' => count($rest)]),
                'color' => null,
                'clientName' => null,
                'seconds' => array_sum(array_column($rest, 'seconds')),
            ],
        ];
    }

    private function weekStart(CarbonImmutable $date, ReportFilters $filters): CarbonImmutable
    {
        return $date->startOfWeek($filters->organization->week_starts_on % 7)->startOfDay();
    }

    /**
     * @param  Builder<TimeEntry>  $query
     * @param  'date'|'duration'|'project'|'member'  $sort
     * @param  'asc'|'desc'  $direction
     * @return Builder<TimeEntry>
     */
    private function sorted(Builder $query, string $sort, string $direction): Builder
    {
        $query = match ($sort) {
            'duration' => $query->orderBy('duration_seconds', $direction),
            'project' => $query->orderBy(
                Project::query()->withoutGlobalScopes()->select('name')->whereColumn('projects.id', 'time_entries.project_id'),
                $direction,
            ),
            'member' => $query->orderBy(
                User::query()->select('name')->whereColumn('users.id', 'time_entries.user_id'),
                $direction,
            ),
            default => $query,
        };

        return $query->orderBy('started_at', $sort === 'date' ? $direction : 'asc')->orderBy('id');
    }

    private function integer(mixed $value): int
    {
        return is_numeric($value) ? (int) $value : 0;
    }
}
