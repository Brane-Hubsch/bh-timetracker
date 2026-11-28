<?php

namespace App\Policies;

use App\Enums\OrganizationPermission;
use App\Models\Absence;
use App\Models\Organization;
use App\Models\User;

/**
 * Everyone manages their own absence; owners and admins (ManageTeamTime) also see and change other
 * members' absence. Colleagues only learn that someone is off, never the kind.
 */
class AbsencePolicy
{
    public function view(User $user, Absence $absence): bool
    {
        return $this->ownsOrManages($user, $absence);
    }

    public function update(User $user, Absence $absence): bool
    {
        return $this->ownsOrManages($user, $absence);
    }

    public function delete(User $user, Absence $absence): bool
    {
        return $this->ownsOrManages($user, $absence);
    }

    public function restore(User $user, Absence $absence): bool
    {
        return $this->ownsOrManages($user, $absence);
    }

    /**
     * Whether the user may register and see the given member's absence in the organization.
     */
    public function manageFor(User $user, Organization $organization, User $member): bool
    {
        if (! $user->belongsToOrganization($organization)) {
            return false;
        }

        return $user->is($member) || $user->hasOrganizationPermission($organization, OrganizationPermission::ManageTeamTime);
    }

    private function ownsOrManages(User $user, Absence $absence): bool
    {
        if (! $user->belongsToOrganization($absence->organization)) {
            return false;
        }

        return $absence->user_id === $user->id
            || $user->hasOrganizationPermission($absence->organization, OrganizationPermission::ManageTeamTime);
    }
}
