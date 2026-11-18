<?php

namespace App\Actions\Organizations;

use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AcceptOrganizationInvitation
{
    /**
     * Add the user to the invitation's organization and make it their current organization.
     */
    public function handle(User $user, OrganizationInvitation $invitation): Organization
    {
        return DB::transaction(function () use ($user, $invitation) {
            $organization = $invitation->organization;

            $organization->memberships()->firstOrCreate(
                ['user_id' => $user->id],
                ['role' => $invitation->role],
            );

            $invitation->update(['accepted_at' => now()]);

            $user->switchOrganization($organization);

            return $organization;
        });
    }
}
