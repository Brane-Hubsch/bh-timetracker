<?php

use App\Actions\Organizations\RemoveOrganizationMember;
use App\Enums\OrganizationRole;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

it('removes the membership', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = $owner->currentOrganization;
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

    app(RemoveOrganizationMember::class)->handle($member, $organization);

    expect($member->fresh()->belongsToOrganization($organization))->toBeFalse()
        ->and($owner->fresh()->belongsToOrganization($organization))->toBeTrue();
});

it('switches the removed user to a remaining organization when it was current', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $remaining = $member->currentOrganization;
    $organization = $owner->currentOrganization;
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);
    $member->switchOrganization($organization);

    app(RemoveOrganizationMember::class)->handle($member, $organization);

    expect($member->fresh()->current_organization_id)->toBe($remaining->id);
});

it('clears the current organization when the user has no other organization', function () {
    $owner = User::factory()->create();
    $member = User::factory()->withoutOrganization()->create();
    $organization = $owner->currentOrganization;
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);
    $member->switchOrganization($organization);

    app(RemoveOrganizationMember::class)->handle($member, $organization);

    expect($member->fresh()->current_organization_id)->toBeNull();
});

it('keeps the current organization when another organization is left', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $current = $member->currentOrganization;
    $organization = $owner->currentOrganization;
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

    app(RemoveOrganizationMember::class)->handle($member, $organization);

    expect($member->fresh()->current_organization_id)->toBe($current->id);
});

it('never removes the owner', function () {
    $owner = User::factory()->create();

    app(RemoveOrganizationMember::class)->handle($owner, $owner->currentOrganization);
})->throws(AuthorizationException::class);
