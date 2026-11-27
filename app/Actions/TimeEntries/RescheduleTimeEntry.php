<?php

namespace App\Actions\TimeEntries;

use App\Data\TimeEntryData;
use App\Models\TimeEntry;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class RescheduleTimeEntry
{
    use ValidatesTimeEntries;

    /**
     * Return the previous schedule if it changed. When undoing, only replace the schedule the
     * calendar saved. The lock keeps the comparison and previous schedule consistent with the write.
     *
     * @param  array{CarbonImmutable, CarbonImmutable}|null  $expected
     * @return array{CarbonImmutable, CarbonImmutable}|null
     */
    public function handle(TimeEntry $entry, CarbonImmutable $start, CarbonImmutable $end, ?array $expected = null): ?array
    {
        return DB::transaction(function () use ($entry, $start, $end, $expected): ?array {
            $current = TimeEntry::query()
                ->forOrganization($entry->organization_id)
                ->where('user_id', $entry->user_id)
                ->lockForUpdate()
                ->findOrFail($entry->id);
            $previous = [$current->started_at, $current->ended_at];

            if ($expected !== null && (! $previous[0]->equalTo($expected[0]) || ! $previous[1]->equalTo($expected[1]))) {
                return null;
            }

            if ($previous[0]->equalTo($start) && $previous[1]->equalTo($end)) {
                return null;
            }

            $this->validateEntry($current->organization, new TimeEntryData(
                userId: $current->user_id,
                projectId: $current->project_id,
                startedAt: $start,
                endedAt: $end,
            ), $current);

            $current->update([
                'started_at' => $start->utc(),
                'ended_at' => $end->utc(),
                'duration_seconds' => (int) $start->diffInSeconds($end),
            ]);

            return $previous;
        }, attempts: 3);
    }
}
