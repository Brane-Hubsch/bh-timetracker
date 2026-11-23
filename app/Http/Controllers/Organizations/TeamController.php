<?php

namespace App\Http\Controllers\Organizations;

use App\Actions\Images\UpdateMemberAvatar;
use App\Actions\Organizations\UpdateTeamMember;
use App\Enums\OrganizationRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Images\ImageUploadRequest;
use App\Http\Requests\Organizations\UpdateTeamMemberRequest;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use App\Support\CurrentOrganization;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends Controller
{
    public function __construct(private readonly CurrentOrganization $currentOrganization) {}

    public function index(Request $request, #[CurrentUser] User $viewer): Response
    {
        $organization = $this->currentOrganization->getOrFail();
        $permissions = $viewer->toOrganizationPermissions($organization);
        $search = $request->string('search')->trim()->limit(200, '')->value();
        $role = OrganizationRole::tryFrom($request->string('role')->value());
        $inactive = $request->string('status')->value() === 'archived';

        $members = $organization->memberships()
            ->when($inactive, fn ($query) => $query->whereNotNull('deactivated_at'), fn ($query) => $query->whereNull('deactivated_at'))
            ->when($role, fn ($query, OrganizationRole $role) => $query->where('role', $role->value))
            ->with('user')
            ->get()
            ->filter(fn (Membership $member) => $search === ''
                || mb_stripos($member->user->name, $search) !== false
                || mb_stripos($member->user->email, $search) !== false)
            ->sortBy(fn (Membership $member) => mb_strtolower($member->user->name))
            ->values()
            ->map(function (Membership $member) use ($viewer, $permissions) {
                $canEdit = $permissions->canUpdateMember
                    && ($member->role !== OrganizationRole::Owner || $member->user_id === $viewer->id);

                return [
                    'id' => $member->user_id,
                    'name' => $member->user->name,
                    'email' => $member->user->email,
                    'avatar' => $member->avatarUrl() ?? $member->user->avatar,
                    'role' => $member->role->value,
                    'roleLabel' => $member->role->label(),
                    'isDeactivated' => $member->isDeactivated(),
                    'canEdit' => $canEdit,
                    ...($permissions->canViewRates ? ['hourlyRate' => $member->hourly_rate] : []),
                    ...($canEdit ? ['schedule' => [
                        'weekStartsOn' => $member->week_starts_on,
                        'workingDays' => $member->working_days ?? Membership::DEFAULT_WORKING_DAYS,
                        'workdayHours' => $member->workday_seconds === null ? null : $member->workday_seconds / 3600,
                    ], 'hasTeamAvatar' => $member->avatar_path !== null] : []),
                ];
            });

        return Inertia::render('team/index', [
            'organization' => [
                'id' => $organization->id,
                'name' => $organization->name,
                'slug' => $organization->slug,
                'currency' => $organization->currency,
                'weekStartsOn' => $organization->week_starts_on,
                'workdayHours' => $organization->workday_seconds / 3600,
            ],
            'members' => $members,
            'canViewRates' => $permissions->canViewRates,
            'canInvite' => $permissions->canCreateInvitation,
            'roles' => array_map(fn (OrganizationRole $role) => ['value' => $role->value, 'label' => $role->label()], OrganizationRole::cases()),
            'filters' => ['search' => $search, 'role' => $role?->value, 'status' => $inactive ? 'archived' : 'active'],
        ]);
    }

    public function update(UpdateTeamMemberRequest $request, int $member, UpdateTeamMember $update): RedirectResponse
    {
        $organization = $this->currentOrganization->getOrFail();
        $membership = $this->editableMember($organization, $member);
        $setRate = $request->has('hourly_rate');

        if ($setRate) {
            Gate::authorize('viewRates', $organization);
        }

        $update->handle($organization, $membership->user, $request->schedule(), $request->role(), $setRate, $request->hourlyRate());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Member settings saved.')]);

        return back();
    }

    public function updateAvatar(ImageUploadRequest $request, int $member, UpdateMemberAvatar $update): RedirectResponse
    {
        $update->handle($this->editableMember($this->currentOrganization->getOrFail(), $member), $request->uploadedImage());

        return back();
    }

    public function removeAvatar(int $member, UpdateMemberAvatar $update): RedirectResponse
    {
        $update->handle($this->editableMember($this->currentOrganization->getOrFail(), $member), null);

        return back();
    }

    private function editableMember(Organization $organization, int $userId): Membership
    {
        $member = $organization->memberships()->where('user_id', $userId)->whereNull('deactivated_at')->with('user')->firstOrFail();
        Gate::authorize('editTeamMember', [$organization, $member]);

        return $member;
    }
}
