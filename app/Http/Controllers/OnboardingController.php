<?php

namespace App\Http\Controllers;

use App\Actions\Organizations\CreateOrganization;
use App\Http\Requests\Organizations\SaveOrganizationRequest;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class OnboardingController extends Controller
{
    /**
     * Show onboarding for users without an organization: pending invitations and "create organization".
     */
    public function show(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

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
    public function store(SaveOrganizationRequest $request, CreateOrganization $createOrganization): RedirectResponse
    {
        Gate::authorize('create', Organization::class);

        $organization = $createOrganization->handle($request->user(), $request->validated('name'));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Organization created.')]);

        return to_route('dashboard', ['current_organization' => $organization->slug]);
    }
}
