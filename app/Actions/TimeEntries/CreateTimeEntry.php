<?php

namespace App\Actions\TimeEntries;

use App\Data\TimeEntryData;
use App\Models\Organization;
use App\Models\Tag;
use App\Models\TimeEntry;
use App\Support\RateResolver;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateTimeEntry
{
    use ValidatesTimeEntries;

    public function __construct(private readonly RateResolver $rateResolver)
    {
        //
    }

    /**
     * Create a time entry with its tags. Billable defaults to the project's setting and the hourly
     * rate is snapshotted, so later price changes do not rewrite history.
     *
     * @throws ValidationException
     */
    public function handle(Organization $organization, TimeEntryData $data): TimeEntry
    {
        [$user, $project] = $this->validateEntry($organization, $data);

        return DB::transaction(function () use ($organization, $data, $user, $project) {
            $tags = $this->resolveTags($organization, $data);

            $entry = TimeEntry::create([
                'organization_id' => $organization->id,
                'user_id' => $user->id,
                'project_id' => $project->id,
                'description' => $this->normalizeDescription($data->description),
                'started_at' => $data->startedAt->utc(),
                'ended_at' => $data->endedAt->utc(),
                'duration_seconds' => (int) $data->startedAt->diffInSeconds($data->endedAt),
                'is_billable' => $data->isBillable ?? $project->is_billable,
                'hourly_rate' => $this->rateResolver->resolve($project, $user),
                'source' => $data->source,
            ]);

            $entry->tags()->sync($tags?->map(fn (Tag $tag) => $tag->id)->all() ?? []);

            return $entry->load('tags');
        });
    }

    private function normalizeDescription(?string $description): ?string
    {
        $description = trim((string) $description);

        return $description === '' ? null : $description;
    }
}
