<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * Working days in a schedule, excluding the organization's holidays.
 */
final class WorkingDays
{
    /**
     * Working days from $from to $to, both included (0 when $to is before $from).
     *
     * @param  array<int, string>  $holidays  Dates (Y-m-d) that are not working days
     * @param  list<int>|null  $workingDays  ISO weekdays, defaulting to Monday to Friday
     */
    public static function between(CarbonImmutable $from, CarbonImmutable $to, array $holidays = [], ?array $workingDays = null): int
    {
        $count = 0;
        $holidays = array_flip($holidays);

        for ($day = $from->startOfDay(); $day->lessThanOrEqualTo($to); $day = $day->addDay()) {
            $isWorkingDay = $workingDays === null
                ? ! $day->isWeekend()
                : in_array($day->dayOfWeekIso, $workingDays, true);

            if ($isWorkingDay && ! isset($holidays[$day->toDateString()])) {
                $count++;
            }
        }

        return $count;
    }
}
