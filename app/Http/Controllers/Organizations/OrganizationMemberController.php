<?php

namespace App\Http\Controllers\Organizations;

use App\Actions\Organizations\RemoveOrganizationMember;
use App\Actions\Organizations\SetOrganizationMemberActive;
use App\Actions\Organizations\UpdateOrganizationMemberRate;
use App\Actions\Organizations\UpdateOrganizationMemberRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Organizations\UpdateMemberRateRequest;
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

    /**
     * Set the member's default hourly rate in the organization.
     */
    public function rate(UpdateMemberRateRequest $request, Organization $organization, User $user, UpdateOrganizationMemberRate $updateRate): RedirectResponse
    {
        Gate::authorize('updateMember', $organization);
        Gate::authorize('viewRates', $organization);

        $updateRate->handle($organization, $user, $request->hourlyRate());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Hourly rate updated.')]);

        return back();
    }

    /**
     * Deactivate a member: no access, history kept.
     */
    public function deactivate(Organization $organization, User $user, SetOrganizationMemberActive $setActive): RedirectResponse
    {
        Gate::authorize('updateMember', $organization);

        $setActive->handle($organization, $user, false);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Member deactivated.')]);

        return back();
    }

    /**
     * Reactivate a deactivated member.
     */
    public function reactivate(Organization $organization, User $user, SetOrganizationMemberActive $setActive): RedirectResponse
    {
        Gate::authorize('updateMember', $organization);

        $setActive->handle($organization, $user, true);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Member reactivated.')]);

        return back();
    }
}
