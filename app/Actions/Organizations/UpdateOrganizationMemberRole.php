<?php

namespace App\Actions\Organizations;

use App\Enums\OrganizationRole;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

class UpdateOrganizationMemberRole
{
    /**
     * Change a member's role in the organization.
     *
     * Ownership cannot be granted or taken away here: the organization must always keep its owner.
     *
     * @throws AuthorizationException
     */
    public function handle(Organization $organization, User $member, OrganizationRole $role): Membership
    {
        $membership = $organization->memberships()
            ->where('user_id', $member->id)
            ->firstOrFail();

        if ($membership->role === OrganizationRole::Owner || $role === OrganizationRole::Owner) {
            throw new AuthorizationException(__('The organization owner\'s role cannot be changed.'));
        }

        $membership->update(['role' => $role]);

        return $membership;
    }
}
