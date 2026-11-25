<?php

namespace App\Actions\Timers;

use App\Data\TimerData;
use App\Models\RunningTimer;
use Illuminate\Validation\ValidationException;

class UpdateTimer
{
    use ValidatesTimers;

    /**
     * Change what the running timer is for, or when it started.
     *
     * @throws ValidationException
     */
    public function handle(RunningTimer $timer, TimerData $data): RunningTimer
    {
        $this->validateTimer($timer->organization, $timer->user, $data);
        $description = trim((string) $data->description);

        $timer->update([
            'project_id' => $data->projectId,
            'description' => $description === '' ? null : $description,
            'is_billable' => $data->isBillable,
            'tags' => $this->tagNames($data->tags),
            'started_at' => $data->startedAt->utc(),
        ]);

        return $timer;
    }
}
