<?php

use App\Actions\Organizations\AcceptOrganizationInvitation;
use App\Actions\Organizations\AddInvitedMember;
use App\Actions\Organizations\CancelOrganizationInvitation;
use App\Actions\Organizations\CreateOrganizationInvitation;
use App\Enums\OrganizationRole;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Notifications\Organizations\OrganizationInvitation as OrganizationInvitationNotification;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

it('creates an invitation that expires in three days and emails it', function () {
    Notification::fake();
    $this->freezeTime();
    $owner = User::factory()->create();
    $organization = $owner->currentOrganization;

    $invitation = app(CreateOrganizationInvitation::class)
        ->handle($organization, $owner, 'new@example.com', OrganizationRole::Admin);

    expect($invitation->organization_id)->toBe($organization->id)
        ->and($invitation->role)->toBe(OrganizationRole::Admin)
        ->and($invitation->invited_by)->toBe($owner->id)
        ->and($invitation->fresh()->expires_at->toDateTimeString())->toBe(now()->addDays(3)->toDateTimeString())
        ->and(strlen($invitation->code))->toBe(64);

    Notification::assertSentOnDemand(OrganizationInvitationNotification::class);
});

it('accepts an invitation: adds membership with the invited role and switches organization', function () {
    $owner = User::factory()->create();
    $invitee = User::factory()->withoutOrganization()->create(['email' => 'invitee@example.com']);
    $organization = $owner->currentOrganization;
    $invitation = OrganizationInvitation::factory()->create([
        'organization_id' => $organization->id,
        'email' => 'invitee@example.com',
        'role' => OrganizationRole::Admin,
        'invited_by' => $owner->id,
    ]);

    $accepted = app(AcceptOrganizationInvitation::class)->handle($invitee, $invitation);

    expect($accepted->is($organization))->toBeTrue()
        ->and($invitee->organizationRole($organization))->toBe(OrganizationRole::Admin)
        ->and($invitee->fresh()->current_organization_id)->toBe($organization->id)
        ->and($invitation->fresh()->accepted_at)->not->toBeNull();
});

it('does not downgrade an existing membership when accepting', function () {
    $owner = User::factory()->create();
    $organization = $owner->currentOrganization;
    $invitation = OrganizationInvitation::factory()->create([
        'organization_id' => $organization->id,
        'email' => $owner->email,
        'role' => OrganizationRole::Member,
        'invited_by' => $owner->id,
    ]);

    app(AcceptOrganizationInvitation::class)->handle($owner, $invitation);

    expect($owner->organizationRole($organization))->toBe(OrganizationRole::Owner);
});

it('lists only pending invitations for an email address', function () {
    $owner = User::factory()->create();
    $attributes = ['organization_id' => $owner->current_organization_id, 'invited_by' => $owner->id];

    $pending = OrganizationInvitation::factory()->create([...$attributes, 'email' => 'Invitee@Example.com']);
    OrganizationInvitation::factory()->create([...$attributes, 'email' => 'invitee@example.com', 'accepted_at' => now()]);
    OrganizationInvitation::factory()->create([...$attributes, 'email' => 'invitee@example.com', 'expires_at' => now()->subMinute()]);
    OrganizationInvitation::factory()->create([...$attributes, 'email' => 'someone-else@example.com']);

    expect(OrganizationInvitation::pendingFor('invitee@example.com')->pluck('id')->all())->toBe([$pending->id]);
});

it('never invites as owner', function () {
    Notification::fake();
    $owner = User::factory()->create();

    app(CreateOrganizationInvitation::class)
        ->handle($owner->currentOrganization, $owner, 'new@example.com', OrganizationRole::Owner);
})->throws(AuthorizationException::class);

it('never accepts an owner invitation', function () {
    $owner = User::factory()->create();
    $invitee = User::factory()->withoutOrganization()->create(['email' => 'invitee@example.com']);
    $invitation = OrganizationInvitation::factory()->create([
        'organization_id' => $owner->current_organization_id,
        'email' => 'invitee@example.com',
        'role' => OrganizationRole::Owner,
        'invited_by' => $owner->id,
    ]);

    app(AcceptOrganizationInvitation::class)->handle($invitee, $invitation);
})->throws(AuthorizationException::class);

it('rejects owner as invitation role in the request', function () {
    $owner = User::factory()->create();

    $this->actingAs($owner)
        ->post(route('organizations.invitations.store', $owner->currentOrganization), [
            'email' => 'new@example.com',
            'role' => 'owner',
        ])
        ->assertSessionHasErrors('role');

    expect($owner->currentOrganization->invitations()->count())->toBe(0);
});

it('cancels an invitation so it can no longer be found', function () {
    $owner = User::factory()->create();
    $invitation = OrganizationInvitation::factory()->create([
        'organization_id' => $owner->current_organization_id,
        'email' => 'invitee@example.com',
        'invited_by' => $owner->id,
    ]);

    app(CancelOrganizationInvitation::class)->handle($invitation);

    expect(OrganizationInvitation::query()->whereKey($invitation->id)->exists())->toBeFalse();
});

it('adds an invited person as a member before they accept, and accepting keeps the membership', function () {
    $owner = User::factory()->create();
    $organization = $owner->currentOrganization;
    $invitation = OrganizationInvitation::factory()->for($organization)->create(['email' => 'New@example.com', 'role' => OrganizationRole::Admin, 'invited_by' => $owner->id]);

    $user = app(AddInvitedMember::class)->handle($invitation, 'Nora New');

    expect($user->email)->toBe('new@example.com')
        ->and($user->name)->toBe('Nora New')
        ->and($user->organizationRole($organization))->toBe(OrganizationRole::Admin)
        ->and($invitation->fresh()->isPending())->toBeTrue();

    app(AcceptOrganizationInvitation::class)->handle($user, $invitation->fresh());

    expect($user->organizationRole($organization))->toBe(OrganizationRole::Admin)
        ->and($organization->memberships()->where('user_id', $user->id)->count())->toBe(1)
        ->and($invitation->fresh()->isAccepted())->toBeTrue();
});

it('does not add members from expired invitations', function () {
    $invitation = OrganizationInvitation::factory()->expired()->create();

    expect(fn () => app(AddInvitedMember::class)->handle($invitation, 'Late'))->toThrow(ValidationException::class)
        ->and(User::query()->where('email', $invitation->email)->exists())->toBeFalse();
});
