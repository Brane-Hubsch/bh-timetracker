<?php

namespace App\Http\Controllers;

use App\Actions\Organizations\CreateOrganization;
use App\Http\Requests\Organizations\SaveOrganizationRequest;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class OnboardingController extends Controller
{
    /**
     * Show onboarding for users without an organization: pending invitations and "create organization".
     */
    public function show(#[CurrentUser] User $user): Response|RedirectResponse
    {

        if ($organization = $user->currentOrganization ?? $user->resetCurrentOrganization()) {
            return to_route('dashboard', ['current_organization' => $organization->slug]);
        }

        return Inertia::render('onboarding', [
            'pendingInvitations' => OrganizationInvitation::query()
                ->pendingFor($user->email)
                ->with(['inviter', 'organization'])
                ->latest()
                ->get()
                ->map(fn (OrganizationInvitation $invitation) => $invitation->toPendingInvitationData()),
        ]);
    }

    /**
     * Create the user's first organization.
     */
    public function store(SaveOrganizationRequest $request, #[CurrentUser] User $user, CreateOrganization $createOrganization): RedirectResponse
    {
        Gate::authorize('create', Organization::class);

        $organization = $createOrganization->handle($user, $request->organizationName());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Organization created.')]);

        return to_route('dashboard', ['current_organization' => $organization->slug]);
    }
}
