<?php

namespace App\Actions\TimeEntries;

use App\Actions\Tags\ResolveTags;
use App\Data\TimeEntryData;
use App\Enums\TimeEntrySource;
use App\Models\Organization;
use App\Models\Project;
use App\Models\Tag;
use App\Models\TimeEntry;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Business rules shared by creating and updating time entries.
 */
trait ValidatesTimeEntries
{
    /**
     * @return array{0: User, 1: Project}
     *
     * @throws ValidationException
     */
    protected function validateEntry(Organization $organization, TimeEntryData $data, ?TimeEntry $existing = null): array
    {
        $user = User::find($data->userId);
        $userChanged = $existing === null || $existing->user_id !== $data->userId;

        // Deactivated members keep their old entries (which admins may still correct), but get no new ones.
        if (! $user || ($userChanged && ! $user->belongsToOrganization($organization))) {
            throw ValidationException::withMessages(['user_id' => __('The user is not a member of the organization.')]);
        }

        $project = Project::query()->forOrganization($organization)->with('client')->find($data->projectId);

        if (! $project) {
            throw ValidationException::withMessages(['project_id' => __('The project does not exist in this organization.')]);
        }

        // Archived projects (or clients) can't get new time; existing entries may keep them. Imported
        // entries may be created on them, since old history mostly belongs to archived projects.
        $projectChanged = $userChanged || $existing->project_id !== $project->id;
        $isImport = $existing === null && $data->source === TimeEntrySource::Import;

        if ($projectChanged && ! $isImport && ($project->isArchived() || $project->client?->isArchived())) {
            throw ValidationException::withMessages(['project_id' => __('The project is archived.')]);
        }

        if ($projectChanged && ! $project->isAccessibleBy($user)) {
            throw ValidationException::withMessages(['project_id' => __(':name is not assigned to this project.', ['name' => $user->name])]);
        }

        if ($data->endedAt->lessThanOrEqualTo($data->startedAt)) {
            throw ValidationException::withMessages(['ended_at' => __('The end time must be after the start time.')]);
        }

        if ($data->startedAt->diffInSeconds($data->endedAt) > TimeEntry::MAX_DURATION_SECONDS) {
            throw ValidationException::withMessages(['ended_at' => __('A time entry can be at most 24 hours.')]);
        }

        return [$user, $project];
    }

    /**
     * The entry's tags by name, created in the organization when missing; null when the data
     * leaves the tags alone.
     *
     * @return Collection<int, Tag>|null
     *
     * @throws ValidationException
     */
    protected function resolveTags(Organization $organization, TimeEntryData $data): ?Collection
    {
        return $data->tags === null
            ? null
            : app(ResolveTags::class)->handle($organization, $data->tags, 'tags', Tag::MAX_PER_ENTRY);
    }
}
