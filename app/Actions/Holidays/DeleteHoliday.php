<?php

namespace App\Actions\Holidays;

use App\Models\Holiday;

class DeleteHoliday
{
    /**
     * Remove a day off; the day counts as a working day again (unless it is a weekend).
     */
    public function handle(Holiday $holiday): void
    {
        $holiday->delete();
    }
}
