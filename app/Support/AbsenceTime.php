<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * How much an absence counts for: its working days (weekdays that aren't holidays) and its time,
 * where a full day is the organization's working day.
 */
final class AbsenceTime
{
    /**
     * @param  array<int, string>  $holidays  Dates (Y-m-d) in the period
     * @return array{days: int, seconds: int}
     */
    public static function for(CarbonImmutable $startsOn, CarbonImmutable $endsOn, ?int $secondsPerDay, int $workdaySeconds, array $holidays): array
    {
        $days = WorkingDays::between($startsOn, $endsOn, $holidays);

        return ['days' => $days, 'seconds' => $days * ($secondsPerDay ?? $workdaySeconds)];
    }
}
