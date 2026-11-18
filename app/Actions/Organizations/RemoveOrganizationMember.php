<?php

namespace App\Actions\Organizations;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class RemoveOrganizationMember
{
    /**
     * Remove the user from the organization (leave or removal by an admin) and move them to another
     * organization if it was their current one. The owner can never be removed.
     *
     * @throws AuthorizationException
     */
    public function handle(User $user, Organization $organization): void
    {
        if ($user->ownsOrganization($organization)) {
            throw new AuthorizationException(__('The organization owner cannot be removed.'));
        }

        DB::transaction(function () use ($user, $organization) {
            $organization->memberships()
                ->where('user_id', $user->id)
                ->delete();

            if ($user->isCurrentOrganization($organization)) {
                $user->resetCurrentOrganization(excluding: $organization);
            }
        });
    }
}
