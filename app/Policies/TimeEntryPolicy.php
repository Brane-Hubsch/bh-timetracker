<?php

namespace App\Policies;

use App\Enums\OrganizationPermission;
use App\Models\Organization;
use App\Models\TimeEntry;
use App\Models\User;

/**
 * Everyone manages their own time; owners and admins also see and change other members' time.
 */
class TimeEntryPolicy
{
    public function view(User $user, TimeEntry $entry): bool
    {
        return $this->ownsOrManages($user, $entry);
    }

    public function update(User $user, TimeEntry $entry): bool
    {
        return $this->ownsOrManages($user, $entry);
    }

    public function delete(User $user, TimeEntry $entry): bool
    {
        return $this->ownsOrManages($user, $entry);
    }

    public function restore(User $user, TimeEntry $entry): bool
    {
        return $this->ownsOrManages($user, $entry);
    }

    /**
     * Whether the user may see and report time for the given member in the organization.
     */
    public function manageFor(User $user, Organization $organization, User $member): bool
    {
        if (! $user->belongsToOrganization($organization)) {
            return false;
        }

        if ($user->is($member)) {
            return true;
        }

        return $user->hasOrganizationPermission($organization, OrganizationPermission::ManageTeamTime);
    }

    private function ownsOrManages(User $user, TimeEntry $entry): bool
    {
        if (! $user->belongsToOrganization($entry->organization)) {
            return false;
        }

        return $entry->user_id === $user->id
            || $user->hasOrganizationPermission($entry->organization, OrganizationPermission::ManageTeamTime);
    }
}
