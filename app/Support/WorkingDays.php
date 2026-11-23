<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * Working days: Monday to Friday, except the given holidays (an organization's holidays).
 */
final class WorkingDays
{
    /**
     * Working days from $from to $to, both included (0 when $to is before $from).
     *
     * @param  array<int, string>  $holidays  Dates (Y-m-d) that are not working days
     */
    public static function between(CarbonImmutable $from, CarbonImmutable $to, array $holidays = []): int
    {
        $count = 0;
        $holidays = array_flip($holidays);

        for ($day = $from->startOfDay(); $day->lessThanOrEqualTo($to); $day = $day->addDay()) {
            if (! $day->isWeekend() && ! isset($holidays[$day->toDateString()])) {
                $count++;
            }
        }

        return $count;
    }
}
