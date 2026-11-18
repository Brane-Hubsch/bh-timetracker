<?php

namespace App\Support;

use App\Models\Organization;
use App\Models\Project;
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
     * @return array{id: int, userId: int, project: array{id: int, name: string, code: string|null, color: string, clientName: string|null}, description: string|null, date: string, start: string, end: string, durationSeconds: int, isBillable: bool}
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
            'date' => $start->toDateString(),
            'start' => $start->format('Y-m-d\TH:i'),
            'end' => $end->format('Y-m-d\TH:i'),
            'durationSeconds' => $entry->duration_seconds,
            'isBillable' => $entry->is_billable,
        ];
    }

    /**
     * Active projects the member can report on (client not archived), the member's most recently
     * used ones first, then alphabetical.
     *
     * @return array<int, array{value: string, label: string, color: string, clientName: string|null, isBillable: bool, isRecent: bool}>
     */
    public function projectOptions(Organization $organization, User $member): array
    {
        $recent = TimeEntry::query()
            ->where('user_id', $member->id)
            ->where('started_at', '>=', now()->subDays(60))
            ->selectRaw('project_id, MAX(started_at) as last_used_at')
            ->groupBy('project_id')
            ->orderByDesc('last_used_at')
            ->limit(5)
            ->pluck('project_id')
            ->all();

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
