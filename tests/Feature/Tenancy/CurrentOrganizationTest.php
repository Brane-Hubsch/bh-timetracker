<?php

use App\Exceptions\MissingCurrentOrganizationException;
use App\Models\Organization;
use App\Models\User;
use App\Support\CurrentOrganization;

it('is empty without an authenticated user', function () {
    $current = app(CurrentOrganization::class);

    expect($current->get())->toBeNull()
        ->and($current->id())->toBeNull()
        ->and($current->has())->toBeFalse();
});

it('throws when an organization is required but missing', function () {
    app(CurrentOrganization::class)->getOrFail();
})->throws(MissingCurrentOrganizationException::class);

it('falls back to the authenticated user\'s current organization', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    expect(app(CurrentOrganization::class)->id())->toBe($user->current_organization_id);
});

it('ignores a stale current organization the user no longer belongs to', function () {
    $user = User::factory()->create();
    $foreign = Organization::factory()->create();
    $user->forceFill(['current_organization_id' => $foreign->id])->save();
    $this->actingAs($user->fresh());

    expect(app(CurrentOrganization::class)->get())->toBeNull();
});

it('prefers an explicitly set organization', function () {
    $user = User::factory()->create();
    $other = Organization::factory()->create();
    $this->actingAs($user);

    $current = app(CurrentOrganization::class);
    $current->set($other);

    expect($current->id())->toBe($other->id);

    $current->forget();

    expect($current->id())->toBe($user->current_organization_id);
});

it('is set from the organization in the URL on tenant routes', function () {
    $user = User::factory()->create();
    $second = Organization::factory()->create();
    $second->members()->attach($user, ['role' => 'member']);

    $this->actingAs($user)
        ->get(route('dashboard', ['current_organization' => $second->slug]))
        ->assertOk();

    expect(app(CurrentOrganization::class)->id())->toBe($second->id)
        ->and($user->fresh()->current_organization_id)->toBe($second->id);
});
