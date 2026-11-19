<?php

namespace App\Actions\TimeEntries;

use App\Models\TimeEntry;

class DeleteTimeEntry
{
    /**
     * Soft delete, so the entry can be restored ("undo").
     */
    public function handle(TimeEntry $entry): void
    {
        $entry->delete();
    }
}
