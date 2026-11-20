<?php

use App\Enums\OrganizationRole;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('shows onboarding with pending invitations to users without an organization', function () {
    $owner = User::factory()->create();
    $user = User::factory()->withoutOrganization()->create(['email' => 'new@example.com']);
    OrganizationInvitation::factory()->create([
        'organization_id' => $owner->current_organization_id,
        'email' => 'new@example.com',
        'invited_by' => $owner->id,
    ]);

    $this->actingAs($user)
        ->get(route('onboarding'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('onboarding')
            ->has('pendingInvitations', 1)
            ->where('pendingInvitations.0.organization.slug', $owner->currentOrganization->slug));
});

it('redirects users that already have an organization to their calendar', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('onboarding'))
        ->assertRedirect(route('time.index', ['current_organization' => $user->currentOrganization->slug]));
});

it('recovers a missing current organization from memberships', function () {
    $user = User::factory()->create();
    $organization = $user->currentOrganization;
    $user->update(['current_organization_id' => null]);

    $this->actingAs($user->fresh())
        ->get(route('onboarding'))
        ->assertRedirect(route('time.index', ['current_organization' => $organization->slug]));

    expect($user->fresh()->current_organization_id)->toBe($organization->id);
});

it('creates the first organization and redirects to its calendar', function () {
    $user = User::factory()->withoutOrganization()->create();

    $response = $this->actingAs($user)->post(route('onboarding.store'), ['name' => 'Brane Hubsch']);

    $organization = $user->fresh()->currentOrganization;
    expect($organization->name)->toBe('Brane Hubsch')
        ->and($user->organizationRole($organization))->toBe(OrganizationRole::Owner);
    $response->assertRedirect(route('time.index', ['current_organization' => $organization->slug]));
});

it('validates the organization name', function () {
    $user = User::factory()->withoutOrganization()->create();

    $this->actingAs($user)
        ->post(route('onboarding.store'), ['name' => ''])
        ->assertSessionHasErrors('name');

    expect($user->fresh()->organizations)->toHaveCount(0);
});

it('requires authentication', function () {
    $this->get(route('onboarding'))->assertRedirect(route('login'));
});

it('sends users without an organization to onboarding after login', function () {
    $user = User::factory()->withoutOrganization()->create();

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])
        ->assertRedirect(route('onboarding', absolute: false));
});

it('sends users back to onboarding after declining their only invitation', function () {
    $owner = User::factory()->create();
    $user = User::factory()->withoutOrganization()->create(['email' => 'new@example.com']);
    $invitation = OrganizationInvitation::factory()->create([
        'organization_id' => $owner->current_organization_id,
        'email' => 'new@example.com',
        'invited_by' => $owner->id,
    ]);

    $this->actingAs($user)
        ->delete(route('invitations.decline', $invitation))
        ->assertRedirect(route('onboarding'));
});
