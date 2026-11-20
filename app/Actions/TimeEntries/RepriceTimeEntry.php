<?php

namespace App\Actions\TimeEntries;

use App\Models\TimeEntry;
use App\Support\RateResolver;

class RepriceTimeEntry
{
    public function __construct(private readonly RateResolver $rateResolver)
    {
        //
    }

    /**
     * Snapshot the rate the rate order gives now and set whether the entry is billable, e.g. when an
     * import of the same rows sets new rates. Returns whether anything changed.
     */
    public function handle(TimeEntry $entry, bool $isBillable): bool
    {
        $entry->loadMissing(['project.organization', 'user']);

        $entry->fill([
            'hourly_rate' => $this->rateResolver->resolve($entry->project, $entry->user),
            'is_billable' => $isBillable,
        ]);

        if (! $entry->isDirty()) {
            return false;
        }

        return $entry->save();
    }
}
