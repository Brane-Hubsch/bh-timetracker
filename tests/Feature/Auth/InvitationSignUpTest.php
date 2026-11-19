<?php

use App\Enums\OrganizationRole;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    $this->invitation = OrganizationInvitation::factory()->create([
        'organization_id' => $this->organization->id,
        'email' => 'Anna@Example.com',
        'role' => OrganizationRole::Member,
        'invited_by' => $this->owner->id,
        'expires_at' => now()->addDays(3),
    ]);
});

it('shows the invitation to guests', function () {
    $this->get(route('invitations.show', $this->invitation->code))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/invitation')
            ->where('invitation.organizationName', $this->organization->name)
            ->where('invitation.status', 'pending')
            ->where('accountExists', false)
            ->where('signedInEmail', null));
});

it('tells existing users to sign in', function () {
    User::factory()->create(['email' => 'anna@example.com']);

    $this->get(route('invitations.show', $this->invitation->code))
        ->assertInertia(fn (Assert $page) => $page->where('accountExists', true));
});

it('shows expired and accepted invitations as unavailable', function () {
    $this->invitation->update(['expires_at' => now()->subMinute()]);

    $this->get(route('invitations.show', $this->invitation->code))
        ->assertInertia(fn (Assert $page) => $page->where('invitation.status', 'expired'));
});

it('creates a passwordless account, joins the organization and offers a passkey', function () {
    $this->post(route('invitations.account.store', $this->invitation->code), ['name' => 'Anna Andersson'])
        ->assertRedirect(route('passkey-setup'));

    $user = User::where('email', 'anna@example.com')->sole();
    $this->assertAuthenticatedAs($user);
    expect($user->password)->toBeNull()
        ->and($user->hasVerifiedEmail())->toBeTrue()
        ->and($user->organizationRole($this->organization))->toBe(OrganizationRole::Member)
        ->and($user->current_organization_id)->toBe($this->organization->id)
        ->and($this->invitation->fresh()->accepted_at)->not->toBeNull()
        ->and(session('auth.password_confirmed_at'))->not->toBeNull();
});

it('does not create a second account for an existing address', function () {
    User::factory()->create(['email' => 'anna@example.com']);

    $this->post(route('invitations.account.store', $this->invitation->code), ['name' => 'Anna'])
        ->assertSessionHasErrors('name');

    $this->assertGuest();
    expect(User::where('email', 'anna@example.com')->count())->toBe(1);
});

it('does not create accounts from expired or used invitations', function (array $state) {
    $this->invitation->update($state);

    $this->post(route('invitations.account.store', $this->invitation->code), ['name' => 'Anna'])
        ->assertSessionHasErrors('name');

    expect(User::where('email', 'anna@example.com')->exists())->toBeFalse();
})->with([
    'expired' => [['expires_at' => '2020-01-01 00:00:00']],
    'accepted' => [['accepted_at' => '2020-01-01 00:00:00']],
]);

it('requires a name', function () {
    $this->post(route('invitations.account.store', $this->invitation->code), ['name' => ''])
        ->assertSessionHasErrors('name');
});

it('is not available to signed-in users', function () {
    $this->actingAs($this->owner)
        ->post(route('invitations.account.store', $this->invitation->code), ['name' => 'Anna'])
        ->assertRedirect();

    expect(User::where('email', 'anna@example.com')->exists())->toBeFalse();
});
