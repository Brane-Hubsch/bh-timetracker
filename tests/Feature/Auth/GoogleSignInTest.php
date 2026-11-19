<?php

use App\Enums\OrganizationRole;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Laravel\Socialite\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

beforeEach(function () {
    config([
        'services.google.client_id' => 'client-id',
        'services.google.client_secret' => 'client-secret',
    ]);
});

function fakeGoogle(array $attributes = []): void
{
    Socialite::fake('google', SocialiteUser::fake([
        'id' => 'google-123',
        'name' => 'Anna Andersson',
        'email' => 'anna@example.com',
        'email_verified' => true,
        ...$attributes,
    ]));
}

it('is unavailable until Google is configured', function () {
    config(['services.google.client_id' => null]);

    $this->get(route('google.redirect'))->assertNotFound();
    $this->get(route('google.callback'))->assertNotFound();
});

it('redirects to Google', function () {
    Socialite::fake('google');

    $this->get(route('google.redirect'))->assertRedirect();
});

it('signs in a user already linked to the Google account', function () {
    $user = User::factory()->create(['google_id' => 'google-123', 'email' => 'old@example.com']);
    $user->passkeys()->create(['name' => 'Mac', 'credential_id' => 'abc', 'credential' => ['x' => 1]]);
    fakeGoogle();

    $this->get(route('google.callback'))
        ->assertRedirect(route('dashboard', ['current_organization' => $user->currentOrganization->slug]));

    $this->assertAuthenticatedAs($user);
});

it('links Google to an existing account with the same verified email', function () {
    $user = User::factory()->unverified()->create(['email' => 'Anna@Example.com']);
    fakeGoogle();

    $this->get(route('google.callback'));

    $this->assertAuthenticatedAs($user);
    expect($user->fresh()->google_id)->toBe('google-123')
        ->and($user->fresh()->hasVerifiedEmail())->toBeTrue()
        ->and(User::count())->toBe(1);
});

it('does not suggest a passkey to existing Google users without one', function () {
    $user = User::factory()->create(['google_id' => 'google-123']);
    fakeGoogle();

    $this->get(route('google.callback'))
        ->assertRedirect(route('dashboard', ['current_organization' => $user->currentOrganization->slug]));
});

it('refuses unknown users when registration is closed and there is no invitation', function () {
    fakeGoogle();

    $this->get(route('google.callback'))
        ->assertRedirect(route('login'))
        ->assertSessionHas('status');

    $this->assertGuest();
    expect(User::count())->toBe(0);
});

it('refuses Google accounts without a verified email', function () {
    User::factory()->create(['email' => 'anna@example.com']);
    fakeGoogle(['email_verified' => false]);

    $this->get(route('google.callback'))->assertRedirect(route('login'));

    $this->assertGuest();
});

it('creates an invited user and accepts the invitation they came from', function () {
    $owner = User::factory()->create();
    $invitation = OrganizationInvitation::factory()->create([
        'organization_id' => $owner->current_organization_id,
        'email' => 'anna@example.com',
        'role' => OrganizationRole::Admin,
        'invited_by' => $owner->id,
    ]);
    Socialite::fake('google');
    $this->get(route('google.redirect', ['invitation' => $invitation->code]));
    fakeGoogle(['avatar' => 'https://example.com/anna.jpg']);

    $this->get(route('google.callback'))->assertRedirect(route('passkey-setup'));

    $user = User::where('email', 'anna@example.com')->sole();
    $this->assertAuthenticatedAs($user);
    expect($user->google_id)->toBe('google-123')
        ->and($user->avatar_url)->toBe('https://example.com/anna.jpg')
        ->and($user->password)->toBeNull()
        ->and($user->hasVerifiedEmail())->toBeTrue()
        ->and($user->organizationRole($owner->currentOrganization))->toBe(OrganizationRole::Admin)
        ->and($invitation->fresh()->accepted_at)->not->toBeNull();
});

it('creates invited users even without the invitation in the session', function () {
    $owner = User::factory()->create();
    OrganizationInvitation::factory()->create([
        'organization_id' => $owner->current_organization_id,
        'email' => 'anna@example.com',
        'invited_by' => $owner->id,
    ]);
    fakeGoogle();

    $this->get(route('google.callback'));

    $user = User::where('email', 'anna@example.com')->sole();
    $this->assertAuthenticatedAs($user);
    // The invitation is left pending; onboarding lists it.
    expect($user->organizations)->toHaveCount(0);
});

it('does not accept an invitation sent to another address', function () {
    $owner = User::factory()->create();
    $invitation = OrganizationInvitation::factory()->create([
        'organization_id' => $owner->current_organization_id,
        'email' => 'someone-else@example.com',
        'invited_by' => $owner->id,
    ]);
    $user = User::factory()->withoutOrganization()->create(['google_id' => 'google-123']);
    Socialite::fake('google');
    $this->get(route('google.redirect', ['invitation' => $invitation->code]));
    fakeGoogle();

    $this->get(route('google.callback'));

    expect($user->fresh()->organizations)->toHaveCount(0)
        ->and($invitation->fresh()->accepted_at)->toBeNull();
});

it('creates users with open registration', function () {
    config(['auth.open_registration' => true]);
    fakeGoogle();

    $this->get(route('google.callback'));

    $this->assertAuthenticated();
    expect(User::where('email', 'anna@example.com')->exists())->toBeTrue();
});
