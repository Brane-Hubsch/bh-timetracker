<?php

namespace App\Support;

use App\Models\Organization;
use App\Models\Project;
use App\Models\Tag;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Shapes time entries and project choices for the time reporting pages. Times are sent as local
 * wall-clock strings ("2026-11-18T09:30") in the viewer's time zone.
 */
class TimeEntryPresenter
{
    /**
     * First day of the week containing the date, honouring the organization's week start
     * (ISO weekday, 1 = Monday, 7 = Sunday).
     */
    public function weekStart(CarbonImmutable $date, Organization $organization): CarbonImmutable
    {
        return $date->startOfWeek($organization->week_starts_on % 7)->startOfDay();
    }

    /**
     * @return array{id: int, userId: int, project: array{id: int, name: string, code: string|null, color: string, clientName: string|null}, description: string|null, tags: array<int, string>, date: string, start: string, end: string, durationSeconds: int, isBillable: bool}
     */
    public function entry(TimeEntry $entry, string $timezone): array
    {
        $start = $entry->started_at->setTimezone($timezone);
        $end = $entry->ended_at->setTimezone($timezone);

        return [
            'id' => $entry->id,
            'userId' => $entry->user_id,
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
        ];
    }

    /**
     * The organization's tag names, alphabetical, as suggestions for the tag field.
     *
     * @return array<int, string>
     */
    public function tagOptions(Organization $organization): array
    {
        return Tag::query()->forOrganization($organization)->get(['id', 'name'])
            ->sortBy(fn (Tag $tag) => mb_strtolower($tag->name))
            ->map(fn (Tag $tag) => $tag->name)
            ->values()
            ->all();
    }

    /**
     * Active members a manager can report time for, as select options.
     *
     * @return array<int, array{value: string, label: string, avatar: string|null}>
     */
    public function memberOptions(Organization $organization): array
    {
        return $organization->members()
            ->wherePivotNull('deactivated_at')
            ->orderBy('name')
            ->get(['users.id', 'users.name', 'users.avatar_path', 'users.avatar_url'])
            ->map(fn (User $member) => [
                'value' => (string) $member->id,
                'label' => $member->name,
                'avatar' => $member->avatar,
            ])
            ->values()
            ->all();
    }

    /**
     * The projects each member reported time on most recently (last 60 days, newest first, at most
     * five), keyed by member id. One query for all members, so the time entry form can follow the
     * member it reports for.
     *
     * @param  array<int, int>  $userIds
     * @return array<int, array<int, int>>
     */
    public function recentProjectIds(Organization $organization, array $userIds): array
    {
        $recent = [];

        TimeEntry::query()
            ->forOrganization($organization)
            ->whereIn('user_id', $userIds)
            ->where('started_at', '>=', now()->subDays(60))
            ->selectRaw('user_id, project_id, MAX(started_at) as last_used_at')
            ->groupBy('user_id', 'project_id')
            ->get()
            // MAX() comes back as a 'Y-m-d H:i:s' string on SQLite and Postgres, which sorts as text.
            ->sortByDesc(fn (TimeEntry $usage) => is_string($lastUsedAt = $usage->getAttribute('last_used_at')) ? $lastUsedAt : '')
            ->each(function (TimeEntry $usage) use (&$recent): void {
                if (count($recent[$usage->user_id] ?? []) < 5) {
                    $recent[$usage->user_id][] = $usage->project_id;
                }
            });

        return $recent;
    }

    /**
     * Recently used project ids per member, for the time entry form's member picker: keyed by member
     * id (a JSON object), with the project ids as strings like the project options.
     *
     * @param  array<int, array{value: string, label: string, avatar: string|null}>  $members
     * @return array<int, array<int, string>>
     */
    public function recentProjectsByMember(Organization $organization, array $members): array
    {
        $recent = $this->recentProjectIds($organization, array_map(fn (array $member) => (int) $member['value'], $members));

        return array_map(fn (array $projectIds) => array_map(fn (int $projectId) => (string) $projectId, $projectIds), $recent);
    }

    /**
     * Active projects the member can report on (client not archived), the member's most recently
     * used ones first, then alphabetical.
     *
     * @return array<int, array{value: string, label: string, color: string, clientName: string|null, isBillable: bool, isRecent: bool}>
     */
    public function projectOptions(Organization $organization, User $member): array
    {
        $recent = $this->recentProjectIds($organization, [$member->id])[$member->id] ?? [];

        $projects = Project::query()
            ->accessibleBy($member, $organization)
            ->active()
            ->where(fn (Builder $query) => $query
                ->whereNull('client_id')
                ->orWhereHas('client', fn (Builder $query) => $query->whereNull('archived_at')))
            ->with('client')
            ->orderBy('name')
            ->get()
            ->sortBy(fn (Project $project) => [
                array_search($project->id, $recent, true) === false ? PHP_INT_MAX : array_search($project->id, $recent, true),
                mb_strtolower($project->name),
            ])
            ->values();

        return $projects->values()->map(fn (Project $project) => [
            'value' => (string) $project->id,
            'label' => $project->name,
            'color' => $project->color,
            'clientName' => $project->client?->name,
            'isBillable' => $project->is_billable,
            'isRecent' => in_array($project->id, $recent, true),
        ])->values()->all();
    }
}
