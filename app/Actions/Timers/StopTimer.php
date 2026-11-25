<?php

namespace App\Actions\Timers;

use App\Actions\TimeEntries\CreateTimeEntry;
use App\Data\TimeEntryData;
use App\Enums\TimeEntrySource;
use App\Models\RunningTimer;
use App\Models\TimeEntry;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StopTimer
{
    public function __construct(private readonly CreateTimeEntry $createTimeEntry)
    {
        //
    }

    /**
     * Stop the timer: save it as a time entry (with the same rules as any entry, through
     * CreateTimeEntry) and remove it. Times are kept to the minute like other entries, and an entry is
     * at least a minute long. The project must be chosen by now.
     *
     * @throws ValidationException
     */
    public function handle(RunningTimer $timer, ?CarbonImmutable $endedAt = null, TimeEntrySource $source = TimeEntrySource::Web): TimeEntry
    {
        if ($timer->project_id === null) {
            throw ValidationException::withMessages(['project_id' => __('Choose a project before stopping the timer.')]);
        }

        $startedAt = $timer->started_at->startOfMinute();
        $endedAt = ($endedAt ?? CarbonImmutable::now())->startOfMinute();

        if ($endedAt->equalTo($startedAt)) {
            $endedAt = $startedAt->addMinute();
        }

        return DB::transaction(function () use ($timer, $startedAt, $endedAt, $source) {
            $entry = $this->createTimeEntry->handle($timer->organization, new TimeEntryData(
                userId: $timer->user_id,
                projectId: (int) $timer->project_id,
                startedAt: $startedAt,
                endedAt: $endedAt,
                description: $timer->description,
                isBillable: $timer->is_billable,
                source: $source,
                tags: $timer->tags ?? [],
            ));

            $timer->delete();

            return $entry;
        });
    }
}
