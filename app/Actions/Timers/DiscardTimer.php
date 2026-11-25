<?php

namespace App\Actions\Timers;

use App\Models\RunningTimer;

class DiscardTimer
{
    /**
     * Throw the running timer away without saving any time.
     */
    public function handle(RunningTimer $timer): void
    {
        $timer->delete();
    }
}
