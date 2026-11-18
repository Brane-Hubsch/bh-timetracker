<?php

namespace App\Http\Controllers\Organizations;

use App\Actions\Organizations\AcceptOrganizationInvitation;
use App\Actions\Organizations\CreateOrganizationInvitation;
use App\Enums\OrganizationRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Organizations\CreateOrganizationInvitationRequest;
use App\Http\Requests\Organizations\RespondToOrganizationInvitationRequest;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class OrganizationInvitationController extends Controller
{
    /**
     * Store a newly created invitation.
     */
    public function store(CreateOrganizationInvitationRequest $request, Organization $organization, CreateOrganizationInvitation $createInvitation): RedirectResponse
    {
        Gate::authorize('inviteMember', $organization);

        $createInvitation->handle(
            $organization,
            $request->user(),
            $request->validated('email'),
            OrganizationRole::from($request->validated('role')),
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invitation sent.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }

    /**
     * Cancel the specified invitation.
     */
    public function destroy(Organization $organization, OrganizationInvitation $invitation): RedirectResponse
    {
        abort_unless($invitation->organization_id === $organization->id, 404);

        Gate::authorize('cancelInvitation', $organization);

        $invitation->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invitation cancelled.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }

    /**
     * Accept the invitation.
     */
    public function accept(RespondToOrganizationInvitationRequest $request, OrganizationInvitation $invitation, AcceptOrganizationInvitation $acceptInvitation): RedirectResponse
    {
        $organization = $acceptInvitation->handle($request->user(), $invitation);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invitation accepted.')]);

        return to_route('dashboard', ['current_organization' => $organization->slug]);
    }

    /**
     * Decline the invitation.
     */
    public function decline(RespondToOrganizationInvitationRequest $request, OrganizationInvitation $invitation): RedirectResponse
    {
        $invitation->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invitation declined.')]);

        $organization = $request->user()->currentOrganization;

        return $organization
            ? to_route('dashboard', ['current_organization' => $organization->slug])
            : to_route('onboarding');
    }
}
