<?php

namespace App\Actions\TimeEntries;

use App\Models\TimeEntry;

class RestoreTimeEntry
{
    /**
     * Undo a delete.
     */
    public function handle(TimeEntry $entry): TimeEntry
    {
        $entry->restore();

        return $entry;
    }
}
