<?php

namespace App\Http\Controllers\Organizations;

use App\Actions\Organizations\RemoveOrganizationMember;
use App\Actions\Organizations\UpdateOrganizationMemberRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Organizations\UpdateOrganizationMemberRequest;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class OrganizationMemberController extends Controller
{
    /**
     * Update the specified organization member's role.
     */
    public function update(UpdateOrganizationMemberRequest $request, Organization $organization, User $user, UpdateOrganizationMemberRole $updateMemberRole): RedirectResponse
    {
        Gate::authorize('updateMember', $organization);

        $updateMemberRole->handle($organization, $user, $request->role());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Member role updated.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }

    /**
     * Remove the specified organization member.
     */
    public function destroy(Organization $organization, User $user, RemoveOrganizationMember $removeOrganizationMember): RedirectResponse
    {
        Gate::authorize('removeMember', $organization);

        $removeOrganizationMember->handle($user, $organization);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Member removed.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }
}
