<?php

namespace App\Actions\Holidays;

use App\Models\Holiday;
use App\Models\Organization;
use App\Support\SwedishHolidays;

class AddSwedishHolidays
{
    /**
     * Add the year's Swedish holidays the organization doesn't have yet (dates it already has, with
     * any name, are kept). Returns how many were added.
     */
    public function handle(Organization $organization, int $year): int
    {
        $existing = Holiday::query()
            ->forOrganization($organization)
            ->whereDate('date', '>=', "{$year}-01-01")
            ->whereDate('date', '<=', "{$year}-12-31")
            ->get(['date'])
            ->map(fn (Holiday $holiday) => $holiday->date->toDateString())
            ->flip();
        $added = 0;

        foreach (SwedishHolidays::for($year) as $date => $name) {
            if (! $existing->has($date)) {
                Holiday::create(['organization_id' => $organization->id, 'date' => $date, 'name' => $name]);
                $added++;
            }
        }

        return $added;
    }
}
