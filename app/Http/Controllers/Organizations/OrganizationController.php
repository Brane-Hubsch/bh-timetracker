<?php

namespace App\Http\Controllers\Organizations;

use App\Actions\Organizations\CreateOrganization;
use App\Actions\Organizations\DeleteOrganization;
use App\Actions\Organizations\RemoveOrganizationMember;
use App\Actions\Organizations\UpdateOrganization;
use App\Enums\OrganizationRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Organizations\DeleteOrganizationRequest;
use App\Http\Requests\Organizations\SaveOrganizationRequest;
use App\Http\Requests\Organizations\UpdateOrganizationRequest;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationController extends Controller
{
    /**
     * Display a listing of the user's organizations.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('organizations/index', [
            'organizations' => $user->toUserOrganizations(includeCurrent: true),
        ]);
    }

    /**
     * Store a newly created organization.
     */
    public function store(SaveOrganizationRequest $request, CreateOrganization $createOrganization): RedirectResponse
    {
        Gate::authorize('create', Organization::class);

        $organization = $createOrganization->handle($request->user(), $request->validated('name'));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Organization created.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }

    /**
     * Show the organization edit page.
     */
    public function edit(Request $request, Organization $organization): Response
    {
        Gate::authorize('view', $organization);

        $user = $request->user();

        return Inertia::render('organizations/edit', [
            'organization' => [
                'id' => $organization->id,
                'name' => $organization->name,
                'slug' => $organization->slug,
                'currency' => $organization->currency,
                'defaultHourlyRate' => $user->can('update', $organization) ? $organization->default_hourly_rate : null,
                'weekStartsOn' => $organization->week_starts_on,
                'timezone' => $organization->timezone,
            ],
            'members' => $organization->members()->get()->map(function (User $member) {
                /** @var Membership $membership */
                $membership = $member->getRelation('pivot');

                return [
                    'id' => $member->id,
                    'name' => $member->name,
                    'email' => $member->email,
                    'avatar' => $member->avatar ?? null,
                    'role' => $membership->role->value,
                    'role_label' => $membership->role->label(),
                ];
            }),
            'invitations' => $organization->invitations()
                ->whereNull('accepted_at')
                ->get()
                ->map(fn ($invitation) => [
                    'code' => $invitation->code,
                    'email' => $invitation->email,
                    'role' => $invitation->role->value,
                    'role_label' => $invitation->role->label(),
                    'created_at' => $invitation->created_at->toISOString(),
                ]),
            'permissions' => $user->toOrganizationPermissions($organization),
            'availableRoles' => OrganizationRole::assignable(),
        ]);
    }

    /**
     * Update the specified organization.
     */
    public function update(UpdateOrganizationRequest $request, Organization $organization, UpdateOrganization $updateOrganization): RedirectResponse
    {
        $organization = $updateOrganization->handle($organization, $request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Organization updated.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }

    /**
     * Switch the user's current organization.
     */
    public function switch(Request $request, Organization $organization): RedirectResponse
    {
        abort_unless($request->user()->belongsToOrganization($organization), 403);

        $request->user()->switchOrganization($organization);

        return back();
    }

    /**
     * Leave the specified organization.
     */
    public function leave(Request $request, Organization $organization, RemoveOrganizationMember $removeOrganizationMember): RedirectResponse
    {
        Gate::authorize('leave', $organization);

        $removeOrganizationMember->handle($request->user(), $organization);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('You left the organization ":name"', ['name' => $organization->name])]);

        return to_route('organizations.index');
    }

    /**
     * Delete the specified organization.
     */
    public function destroy(DeleteOrganizationRequest $request, Organization $organization, DeleteOrganization $deleteOrganization): RedirectResponse
    {
        $deleteOrganization->handle($organization);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Organization deleted.')]);

        return to_route('organizations.index');
    }
}
