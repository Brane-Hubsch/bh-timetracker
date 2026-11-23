<?php

namespace App\Support;

use App\Models\Project;
use Carbon\CarbonImmutable;

/**
 * How a project stands against its estimate: the hours left to 100 %, the working days left in the
 * project's period (from today, or from its start if that is later, to its end date) and the hours
 * needed per working day to reach the estimate.
 */
final class EstimatePace
{
    /**
     * Null without an estimate. Days are local dates; "today" is in the viewer's time zone.
     *
     * @return array{remainingSeconds: int, workdaysLeft: int|null, secondsPerWorkday: int|null, from: string|null, to: string|null}|null
     */
    public static function for(Project $project, int $consumedSeconds, CarbonImmutable $today): ?array
    {
        if (! $project->estimate_seconds) {
            return null;
        }

        $remaining = $project->estimate_seconds - $consumedSeconds;

        if ($project->ends_on === null) {
            return ['remainingSeconds' => $remaining, 'workdaysLeft' => null, 'secondsPerWorkday' => null, 'from' => null, 'to' => null];
        }

        $today = $today->startOfDay();
        $startsOn = $project->starts_on ? CarbonImmutable::parse($project->starts_on->toDateString(), $today->timezone) : null;
        $from = $startsOn?->greaterThan($today) ? $startsOn : $today;
        $to = CarbonImmutable::parse($project->ends_on->toDateString(), $today->timezone);
        $workdays = WorkingDays::between($from, $to);

        return [
            'remainingSeconds' => $remaining,
            'workdaysLeft' => $workdays,
            'secondsPerWorkday' => $remaining > 0 && $workdays > 0 ? (int) ceil($remaining / $workdays) : null,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
        ];
    }
}
