<?php

use App\Enums\OrganizationRole;
use App\Models\OrganizationInvitation;
use App\Models\User;

/*
 * A user must never be able to read or change another organization's data, regardless of role
 * in their own organization.
 */

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->foreignOwner = User::factory()->create();
    $this->foreign = $this->foreignOwner->currentOrganization;
    $this->foreignMember = User::factory()->withoutOrganization()->create();
    $this->foreign->members()->attach($this->foreignMember, ['role' => OrganizationRole::Member->value]);
    $this->foreignInvitation = OrganizationInvitation::factory()->create([
        'organization_id' => $this->foreign->id,
        'invited_by' => $this->foreignOwner->id,
    ]);
});

it('cannot open another organization\'s dashboard', function () {
    $this->actingAs($this->owner)
        ->get(route('dashboard', ['current_organization' => $this->foreign->slug]))
        ->assertForbidden();

    expect($this->owner->fresh()->current_organization_id)->not->toBe($this->foreign->id);
});

it('cannot view another organization\'s settings', function () {
    $this->actingAs($this->owner)
        ->get(route('organizations.edit', $this->foreign))
        ->assertForbidden();
});

it('cannot switch to another organization', function () {
    $this->actingAs($this->owner)
        ->post(route('organizations.switch', $this->foreign))
        ->assertForbidden();

    expect($this->owner->fresh()->current_organization_id)->not->toBe($this->foreign->id);
});

it('cannot update another organization', function () {
    $this->actingAs($this->owner)
        ->patch(route('organizations.update', $this->foreign), [
            'name' => 'Hijacked',
            'currency' => 'SEK',
            'week_starts_on' => 1,
            'timezone' => 'Europe/Stockholm',
        ])
        ->assertForbidden();

    expect($this->foreign->fresh()->name)->not->toBe('Hijacked');
});

it('cannot delete another organization', function () {
    $this->actingAs($this->owner)
        ->delete(route('organizations.destroy', $this->foreign), ['name' => $this->foreign->name])
        ->assertForbidden();

    expect($this->foreign->fresh()->trashed())->toBeFalse();
});

it('cannot change roles or remove members in another organization', function () {
    $this->actingAs($this->owner)
        ->patch(route('organizations.members.update', [$this->foreign, $this->foreignMember]), ['role' => 'admin'])
        ->assertForbidden();

    $this->actingAs($this->owner)
        ->delete(route('organizations.members.destroy', [$this->foreign, $this->foreignMember]))
        ->assertForbidden();

    expect($this->foreignMember->organizationRole($this->foreign))->toBe(OrganizationRole::Member);
});

it('cannot invite to or cancel invitations of another organization', function () {
    $this->actingAs($this->owner)
        ->post(route('organizations.invitations.store', $this->foreign), ['email' => 'x@example.com', 'role' => 'member'])
        ->assertForbidden();

    $this->actingAs($this->owner)
        ->delete(route('organizations.invitations.destroy', [$this->foreign, $this->foreignInvitation]))
        ->assertForbidden();

    expect($this->foreign->invitations()->count())->toBe(1);
});

it('cannot cancel another organization\'s invitation through its own organization', function () {
    $this->actingAs($this->owner)
        ->delete(route('organizations.invitations.destroy', [$this->owner->currentOrganization, $this->foreignInvitation]))
        ->assertNotFound();

    expect($this->foreignInvitation->fresh())->not->toBeNull();
});

it('cannot accept an invitation addressed to someone else', function () {
    $this->actingAs($this->owner)
        ->post(route('invitations.accept', $this->foreignInvitation))
        ->assertSessionHasErrors('invitation');

    expect($this->owner->belongsToOrganization($this->foreign))->toBeFalse();
});

it('only lists the user\'s own organizations', function () {
    $this->actingAs($this->owner)
        ->get(route('organizations.index'))
        ->assertInertia(fn ($page) => $page
            ->has('organizations', 1)
            ->where('organizations.0.id', $this->owner->current_organization_id));
});
