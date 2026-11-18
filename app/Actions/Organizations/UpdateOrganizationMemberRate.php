<?php

namespace App\Actions\Organizations;

use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;

class UpdateOrganizationMemberRate
{
    /**
     * Set the member's default hourly rate in the organization (minor currency unit, öre), or null
     * to fall back to the organization's default rate.
     */
    public function handle(Organization $organization, User $member, ?int $hourlyRate): Membership
    {
        $membership = $organization->memberships()
            ->where('user_id', $member->id)
            ->firstOrFail();

        $membership->update(['hourly_rate' => $hourlyRate]);

        return $membership;
    }
}
