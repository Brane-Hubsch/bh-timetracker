<?php

namespace App\Actions\Organizations;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class DeleteOrganization
{
    /**
     * Delete the organization and move every user who had it as current organization elsewhere.
     */
    public function handle(Organization $organization): void
    {
        DB::transaction(function () use ($organization) {
            User::where('current_organization_id', $organization->id)
                ->each(fn (User $user) => $user->resetCurrentOrganization(excluding: $organization));

            $organization->invitations()->delete();
            $organization->memberships()->delete();
            $organization->delete();
        });
    }
}
