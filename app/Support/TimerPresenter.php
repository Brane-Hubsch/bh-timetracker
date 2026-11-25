<?php

namespace App\Support;

use App\Models\RunningTimer;
use App\Models\User;

/**
 * The running timer as every page gets it (shared prop): times both as a UTC instant, for the
 * ticking clock, and as local wall-clock time in the viewer's time zone, for forms and the calendar.
 */
final class TimerPresenter
{
    /**
     * @return array{organization: array{slug: string, name: string}, project: array{id: int, name: string, color: string, clientName: string|null}|null, description: string|null, tags: array<int, string>, isBillable: bool|null, startedAt: string, start: string, isLong: bool}
     */
    public static function present(RunningTimer $timer, User $viewer): array
    {
        $project = $timer->project;

        return [
            'organization' => ['slug' => $timer->organization->slug, 'name' => $timer->organization->name],
            'project' => $project === null ? null : [
                'id' => $project->id,
                'name' => $project->name,
                'color' => $project->color,
                'clientName' => $project->client?->name,
            ],
            'description' => $timer->description,
            'tags' => $timer->tags ?? [],
            'isBillable' => $timer->is_billable,
            'startedAt' => $timer->started_at->utc()->toIso8601String(),
            'start' => $timer->started_at->setTimezone($viewer->timezone)->format('Y-m-d\TH:i'),
            'isLong' => $timer->started_at->diffInSeconds(now()) >= RunningTimer::LONG_SECONDS,
        ];
    }
}
