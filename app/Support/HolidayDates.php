<?php

namespace App\Support;

use App\Models\Holiday;
use Carbon\CarbonImmutable;

/**
 * An organization's holidays in a period, as dates (Y-m-d) for WorkingDays.
 */
final class HolidayDates
{
    /**
     * @return array<int, string>
     */
    public static function between(int $organizationId, CarbonImmutable $from, CarbonImmutable $to): array
    {
        return Holiday::query()
            ->forOrganization($organizationId)
            ->whereDate('date', '>=', $from->toDateString())
            ->whereDate('date', '<=', $to->toDateString())
            ->get(['date'])
            ->map(fn (Holiday $holiday) => $holiday->date->toDateString())
            ->all();
    }
}
