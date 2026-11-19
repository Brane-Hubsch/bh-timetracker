<?php

namespace App\Actions\TimeEntries;

use App\Data\TimeEntryData;
use App\Models\Tag;
use App\Models\TimeEntry;
use App\Support\RateResolver;
use Illuminate\Validation\ValidationException;

class UpdateTimeEntry
{
    use ValidatesTimeEntries;

    public function __construct(private readonly RateResolver $rateResolver)
    {
        //
    }

    /**
     * Update a time entry. The rate snapshot is only renewed when the project or user changes, so
     * editing an old entry (e.g. its description) keeps the rate it was reported with. Tags are
     * replaced when given and kept otherwise.
     *
     * @throws ValidationException
     */
    public function handle(TimeEntry $entry, TimeEntryData $data): TimeEntry
    {
        [$user, $project] = $this->validateEntry($entry->organization, $data, $entry);
        $tags = $this->resolveTags($entry->organization, $data);

        $assignmentChanged = $entry->project_id !== $project->id || $entry->user_id !== $user->id;
        $description = trim((string) $data->description);

        $entry->update([
            'user_id' => $user->id,
            'project_id' => $project->id,
            'description' => $description === '' ? null : $description,
            'started_at' => $data->startedAt->utc(),
            'ended_at' => $data->endedAt->utc(),
            'duration_seconds' => (int) $data->startedAt->diffInSeconds($data->endedAt),
            'is_billable' => $data->isBillable ?? $entry->is_billable,
            'hourly_rate' => $assignmentChanged ? $this->rateResolver->resolve($project, $user) : $entry->hourly_rate,
        ]);

        if ($tags !== null) {
            $entry->tags()->sync($tags->map(fn (Tag $tag) => $tag->id)->all());
        }

        return $entry->load('tags');
    }
}
