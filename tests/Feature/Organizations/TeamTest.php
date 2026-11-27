<?php

use App\Actions\Organizations\AcceptOrganizationInvitation;
use App\Actions\Organizations\AddInvitedMember;
use App\Actions\Organizations\RemoveOrganizationMember;
use App\Enums\OrganizationRole;
use App\Models\OrganizationInvitation;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->owner = User::factory()->create(['name' => 'Amanda Owner']);
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Bea Member', 'email' => 'bea@example.test']);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member, 'hourly_rate' => 95000]);
    $this->team = route('team.index', $this->organization->slug);
    $this->update = route('team.update', [$this->organization->slug, $this->member->id]);
    $this->schedule = ['week_starts_on' => 7, 'working_days' => [2, 3, 5, 7], 'workday_hours' => 7.5];
});

it('filters the team by role, literal search and activation status', function () {
    $this->actingAs($this->owner)
        ->get($this->team.'?role=member&search=BEA%40')
        ->assertInertia(fn (Assert $page) => $page
            ->component('team/index')
            ->has('members', 1)
            ->where('members.0.name', 'Bea Member')
            ->where('members.0.hourlyRate', 95000));

    $this->from($this->team)
        ->post(route('organizations.members.deactivate', [$this->organization, $this->member]))
        ->assertRedirect($this->team);

    $this->get($this->team)->assertInertia(fn (Assert $page) => $page->has('members', 1)->where('members.0.id', $this->owner->id));
    $this->get($this->team.'?status=archived')->assertInertia(fn (Assert $page) => $page
        ->has('members', 1)
        ->where('members.0.isDeactivated', true)
        ->where('members.0.id', $this->member->id));

    $this->from($this->team.'?status=archived')
        ->post(route('organizations.members.reactivate', [$this->organization, $this->member]))
        ->assertRedirect($this->team.'?status=archived');

    $this->get($this->team)->assertInertia(fn (Assert $page) => $page->has('members', 2));
});

it('keeps rates and editing rights out of member responses and rejects writes', function () {
    $this->actingAs($this->member)
        ->get($this->team)
        ->assertInertia(fn (Assert $page) => $page
            ->where('canViewRates', false)
            ->where('canInvite', false)
            ->where('members.1.canEdit', false)
            ->missing('members.1.hourlyRate')
            ->missing('members.1.schedule'));

    $this->patch($this->update, $this->schedule)->assertForbidden();
});

it('distinguishes an unfiltered team of one from filtered results for the invite hint', function () {
    $this->actingAs($this->owner)
        ->get($this->team)
        ->assertInertia(fn (Assert $page) => $page->has('members', 2));

    $this->from($this->team)
        ->post(route('organizations.members.deactivate', [$this->organization, $this->member]))
        ->assertRedirect($this->team);

    $this->get($this->team)->assertInertia(fn (Assert $page) => $page
        ->has('members', 1)
        ->where('members.0.id', $this->owner->id)
        ->where('canInvite', true)
        ->where('filters', ['search' => '', 'role' => null, 'status' => 'active']));

    $this->get($this->team.'?role=owner&search=Amanda')->assertInertia(fn (Assert $page) => $page
        ->has('members', 1)
        ->where('members.0.id', $this->owner->id)
        ->where('filters', ['search' => 'Amanda', 'role' => 'owner', 'status' => 'active']));
});

it('saves the schedule, role and rate together for the targeted membership', function () {
    $otherOrg = User::factory()->create()->currentOrganization;
    $otherOrg->members()->attach($this->member, ['role' => OrganizationRole::Member, 'hourly_rate' => 20000]);

    $this->actingAs($this->owner)->from($this->team)
        ->patch($this->update, [...$this->schedule, 'role' => 'admin', 'hourly_rate' => 110000])
        ->assertRedirect($this->team)
        ->assertSessionHasNoErrors();

    $member = $this->organization->memberships()->where('user_id', $this->member->id)->firstOrFail();
    expect($member->role)->toBe(OrganizationRole::Admin)
        ->and($member->hourly_rate)->toBe(110000)
        ->and($member->week_starts_on)->toBe(7)
        ->and($member->working_days)->toBe([2, 3, 5, 7])
        ->and($member->workday_seconds)->toBe(27000);

    $foreignMembership = $otherOrg->memberships()->where('user_id', $this->member->id)->firstOrFail();
    expect($foreignMembership->working_days)->toBeNull()
        ->and($foreignMembership->hourly_rate)->toBe(20000);

    $this->get(route('time.index', ['current_organization' => $this->organization->slug, 'user' => $this->member->id, 'date' => '2026-11-23']))
        ->assertInertia(fn (Assert $page) => $page->where('weekStart', '2026-11-22')->where('weekStartsOn', 7));
    $this->get(route('time.index', ['current_organization' => $this->organization->slug, 'date' => '2026-11-23']))
        ->assertInertia(fn (Assert $page) => $page->where('weekStart', '2026-11-23')->where('weekStartsOn', 1));
});

it('rejects invalid schedules and foreign members', function () {
    $foreign = User::factory()->create();

    $this->actingAs($this->owner)->from($this->team)
        ->patch($this->update, [...$this->schedule, 'working_days' => [2, 2, 8], 'workday_hours' => 25])
        ->assertSessionHasErrors(['working_days.0', 'working_days.2', 'workday_hours']);

    $this->patch(route('team.update', [$this->organization->slug, $foreign->id]), $this->schedule)
        ->assertNotFound();
});

it('protects the owner while allowing the owner to edit their own schedule', function () {
    $this->organization->memberships()->where('user_id', $this->member->id)->update(['role' => OrganizationRole::Admin]);
    $ownerUpdate = route('team.update', [$this->organization->slug, $this->owner->id]);

    $this->actingAs($this->member)->patch($ownerUpdate, $this->schedule)->assertForbidden();

    $this->actingAs($this->owner)->from($this->team)
        ->patch($ownerUpdate, [...$this->schedule, 'working_days' => []])
        ->assertRedirect($this->team)
        ->assertSessionHasNoErrors();
    $this->patch($ownerUpdate, [...$this->schedule, 'role' => 'member'])->assertForbidden();
    expect($this->organization->memberships()->where('user_id', $this->owner->id)->firstOrFail()->working_days)->toBe([]);
});

it('enables Team when a second member joins and keeps it after removal', function () {
    Notification::fake();
    $solo = User::factory()->create();
    $organization = $solo->currentOrganization;
    $invitee = User::factory()->withoutOrganization()->create();
    $team = route('team.index', $organization->slug);

    $this->actingAs($solo)->get($team)->assertInertia(fn (Assert $page) => $page->where('currentOrganization.hasTeam', false));
    $this->post(route('organizations.invitations.store', $organization), [
        'email' => $invitee->email,
        'role' => 'member',
        'from_team' => true,
    ])->assertRedirect($team);

    expect($organization->refresh()->team_enabled)->toBeFalse();
    app(AcceptOrganizationInvitation::class)->handle($invitee, $organization->invitations()->firstOrFail());

    $this->get($team)->assertInertia(fn (Assert $page) => $page->where('currentOrganization.hasTeam', true));
    app(RemoveOrganizationMember::class)->handle($invitee, $organization);
    $this->get($team)->assertInertia(fn (Assert $page) => $page->where('currentOrganization.hasTeam', true)->has('members', 1));
});

it('enables Team when an imported person is given a membership before accepting', function () {
    $solo = User::factory()->create();
    $organization = $solo->currentOrganization;
    $invitation = OrganizationInvitation::factory()->for($organization)->create(['invited_by' => $solo->id]);
    app(AddInvitedMember::class)->handle($invitation, 'Imported member');

    expect($organization->refresh()->team_enabled)->toBeTrue()
        ->and($invitation->refresh()->accepted_at)->toBeNull();
});

it('adds and removes a workspace profile picture without changing the user profile', function () {
    Storage::fake('public');
    $url = route('team.avatar.update', [$this->organization->slug, $this->member->id]);
    $image = UploadedFile::fake()->image('portrait.png', 40, 40);

    $this->actingAs($this->member)->post($url, ['image' => $image])->assertForbidden();
    $this->actingAs($this->owner)->from($this->team)
        ->post($url, ['image' => $image])
        ->assertRedirect($this->team)
        ->assertSessionHasNoErrors();

    $membership = $this->organization->memberships()->where('user_id', $this->member->id)->firstOrFail();
    $avatar = Storage::disk('public')->url("{$membership->avatar_path}/128.webp");
    $slug = $this->organization->slug;

    expect($this->member->refresh()->avatar_path)->toBeNull()
        ->and($membership->avatar_path)->not->toBeNull();
    $this->get($this->team)->assertInertia(fn (Assert $page) => $page
        ->where('members.1.hasTeamAvatar', true)
        ->where('members.1.avatar', $avatar));
    $this->get(route('time.index', $slug))->assertInertia(fn (Assert $page) => $page
        ->where('members.1.avatar', $avatar));
    $this->get(route('reports.summary', $slug))->assertInertia(fn (Assert $page) => $page
        ->where('options.members.1.avatar', $avatar));
    $this->get(route('organizations.edit', $slug))->assertInertia(fn (Assert $page) => $page
        ->where('members.1.avatar', $avatar));

    $project = Project::factory()->for($this->organization)->create();
    $project->members()->attach($this->member);
    $this->get(route('projects.show', [$slug, $project]))->assertInertia(fn (Assert $page) => $page
        ->where('members.0.avatar', $avatar));

    $this->from($this->team)->delete($url)->assertRedirect($this->team);
    expect($membership->refresh()->avatar_path)->toBeNull();
    $this->get(route('time.index', $slug))->assertInertia(fn (Assert $page) => $page
        ->where('members.1.avatar', null));
});

it('uses a team avatar for the signed-in member only in that organization', function () {
    $teamPath = 'images/avatars/team';
    $profilePath = 'images/avatars/profile';
    $this->member->update(['avatar_path' => $profilePath, 'avatar_url' => 'https://example.test/google.jpg']);
    $this->organization->members()->updateExistingPivot($this->member, ['avatar_path' => $teamPath]);

    $other = User::factory()->create()->currentOrganization;
    $other->members()->attach($this->member, ['role' => OrganizationRole::Member]);

    $this->actingAs($this->member)
        ->get(route('time.index', $this->organization->slug))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.avatar', Storage::disk('public')->url("{$teamPath}/128.webp")));
    $this->get(route('time.index', $other->slug))->assertInertia(fn (Assert $page) => $page
        ->where('auth.user.avatar', Storage::disk('public')->url("{$profilePath}/128.webp")));
});
