<?php

namespace App\Actions\Timers;

use App\Data\TimerData;
use App\Models\Organization;
use App\Models\Project;
use App\Models\Tag;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * Rules for a running timer: an active member, an accessible non-archived project when one is
 * chosen, and a start that is neither in the future nor more than 24 hours ago (an entry is at most
 * 24 hours).
 */
trait ValidatesTimers
{
    /**
     * @throws ValidationException
     */
    protected function validateTimer(Organization $organization, User $user, TimerData $data): ?Project
    {
        if (! $user->belongsToOrganization($organization)) {
            throw ValidationException::withMessages(['user_id' => __('The user is not a member of the organization.')]);
        }

        $project = null;

        if ($data->projectId !== null) {
            $project = Project::query()->forOrganization($organization)->with('client')->find($data->projectId);

            if (! $project) {
                throw ValidationException::withMessages(['project_id' => __('The project does not exist in this organization.')]);
            }

            if ($project->isArchived() || $project->client?->isArchived()) {
                throw ValidationException::withMessages(['project_id' => __('The project is archived.')]);
            }

            if (! $project->isAccessibleBy($user)) {
                throw ValidationException::withMessages(['project_id' => __(':name is not assigned to this project.', ['name' => $user->name])]);
            }
        }

        $now = CarbonImmutable::now();

        if ($data->startedAt->greaterThan($now->addMinute())) {
            throw ValidationException::withMessages(['start' => __('The timer cannot start in the future.')]);
        }

        if ($data->startedAt->lessThan($now->subSeconds(TimeEntry::MAX_DURATION_SECONDS))) {
            throw ValidationException::withMessages(['start' => __('A time entry can be at most 24 hours.')]);
        }

        if (count($data->tags) > Tag::MAX_PER_ENTRY) {
            throw ValidationException::withMessages(['tags' => __('A time entry can have at most :max tags.', ['max' => Tag::MAX_PER_ENTRY])]);
        }

        return $project;
    }

    /**
     * The tag names to keep: trimmed, without empty or repeated ones.
     *
     * @param  array<int, string>  $tags
     * @return array<int, string>
     */
    protected function tagNames(array $tags): array
    {
        $names = [];

        foreach ($tags as $tag) {
            $name = trim($tag);

            if ($name !== '' && ! in_array(mb_strtolower($name), array_map('mb_strtolower', $names), true)) {
                $names[] = mb_substr($name, 0, Tag::MAX_NAME_LENGTH);
            }
        }

        return $names;
    }
}
