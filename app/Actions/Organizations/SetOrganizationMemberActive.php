<?php

namespace App\Actions\Organizations;

use App\Enums\OrganizationRole;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class SetOrganizationMemberActive
{
    /**
     * Deactivate or reactivate a member. Deactivated members lose access to the organization but
     * keep their history (time entries, project assignments). The owner cannot be deactivated.
     *
     * @throws AuthorizationException
     */
    public function handle(Organization $organization, User $member, bool $active): Membership
    {
        return DB::transaction(function () use ($organization, $member, $active) {
            $membership = $organization->memberships()
                ->where('user_id', $member->id)
                ->firstOrFail();

            if (! $active && $membership->role === OrganizationRole::Owner) {
                throw new AuthorizationException(__('The organization owner cannot be deactivated.'));
            }

            $membership->update(['deactivated_at' => $active ? null : ($membership->deactivated_at ?? now())]);

            if (! $active && $member->isCurrentOrganization($organization)) {
                $member->resetCurrentOrganization(excluding: $organization);
            }

            return $membership;
        });
    }
}
