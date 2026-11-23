<?php

namespace App\Actions\Organizations;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class AcceptOrganizationInvitation
{
    /**
     * Add the user to the invitation's organization and make it their current organization.
     *
     * @throws AuthorizationException
     */
    public function handle(User $user, OrganizationInvitation $invitation): Organization
    {
        if ($invitation->role === OrganizationRole::Owner) {
            throw new AuthorizationException(__('Ownership cannot be granted through an invitation.'));
        }

        return DB::transaction(function () use ($user, $invitation) {
            $organization = $invitation->organization;

            $organization->memberships()->firstOrCreate(
                ['user_id' => $user->id],
                ['role' => $invitation->role],
            );

            if (! $organization->team_enabled) {
                $organization->update(['team_enabled' => true]);
            }

            $invitation->update(['accepted_at' => now()]);

            $user->switchOrganization($organization);

            return $organization;
        });
    }
}
