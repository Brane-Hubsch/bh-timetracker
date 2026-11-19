<?php

namespace App\Http\Controllers\Organizations;

use App\Actions\Organizations\AcceptOrganizationInvitation;
use App\Actions\Organizations\CancelOrganizationInvitation;
use App\Actions\Organizations\CreateOrganizationInvitation;
use App\Http\Controllers\Controller;
use App\Http\Requests\Organizations\CreateOrganizationInvitationRequest;
use App\Http\Requests\Organizations\RespondToOrganizationInvitationRequest;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class OrganizationInvitationController extends Controller
{
    /**
     * Store a newly created invitation.
     */
    public function store(CreateOrganizationInvitationRequest $request, #[CurrentUser] User $user, Organization $organization, CreateOrganizationInvitation $createInvitation): RedirectResponse
    {
        Gate::authorize('inviteMember', $organization);

        $createInvitation->handle(
            $organization,
            $user,
            $request->invitationEmail(),
            $request->role(),
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invitation sent.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }

    /**
     * Cancel the specified invitation.
     */
    public function destroy(Organization $organization, OrganizationInvitation $invitation, CancelOrganizationInvitation $cancelInvitation): RedirectResponse
    {
        abort_unless($invitation->organization_id === $organization->id, 404);

        Gate::authorize('cancelInvitation', $organization);

        $cancelInvitation->handle($invitation);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invitation cancelled.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }

    /**
     * Accept the invitation.
     */
    public function accept(RespondToOrganizationInvitationRequest $request, #[CurrentUser] User $user, OrganizationInvitation $invitation, AcceptOrganizationInvitation $acceptInvitation): RedirectResponse
    {
        $organization = $acceptInvitation->handle($user, $invitation);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invitation accepted.')]);

        return to_route('dashboard', ['current_organization' => $organization->slug]);
    }

    /**
     * Decline the invitation.
     */
    public function decline(RespondToOrganizationInvitationRequest $request, #[CurrentUser] User $user, OrganizationInvitation $invitation): RedirectResponse
    {
        $invitation->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invitation declined.')]);

        $organization = $user->currentOrganization;

        return $organization
            ? to_route('dashboard', ['current_organization' => $organization->slug])
            : to_route('onboarding');
    }
}
