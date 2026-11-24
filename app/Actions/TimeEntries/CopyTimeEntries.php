<?php

namespace App\Actions\TimeEntries;

use App\Data\TimeEntryData;
use App\Models\Organization;
use App\Models\TimeEntry;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class CopyTimeEntries
{
    public function __construct(private readonly CreateTimeEntries $createTimeEntries)
    {
        //
    }

    /**
     * @param  Collection<int, TimeEntry>  $sources  Authorized entries with tags loaded.
     * @return Collection<int, TimeEntry>
     */
    public function handle(Organization $organization, Collection $sources, ?CarbonImmutable $targetDay): Collection
    {
        $previousDay = $targetDay?->subDay();

        $entries = $sources->map(function (TimeEntry $entry) use ($previousDay) {
            if ($previousDay === null) {
                $start = $entry->started_at->addWeek();
                $end = $entry->ended_at->addWeek();
            } else {
                $sourceStart = $entry->started_at->setTimezone($previousDay->getTimezone());

                if (! $sourceStart->isSameDay($previousDay)) {
                    throw ValidationException::withMessages([
                        'entry_ids' => __('Select entries from the previous day.'),
                    ]);
                }

                $start = $sourceStart->addDay()->utc();
                $end = $start->addSeconds($entry->duration_seconds);
            }

            return new TimeEntryData(
                userId: $entry->user_id,
                projectId: $entry->project_id,
                startedAt: $start,
                endedAt: $end,
                description: $entry->description,
                isBillable: $entry->is_billable,
                tags: $entry->tagNames(),
            );
        })->all();

        return $this->createTimeEntries->handle($organization, $entries);
    }
}
