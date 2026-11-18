<?php

use App\Actions\Organizations\DeleteOrganization;
use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;

it('soft deletes the organization and removes memberships and invitations', function () {
    $owner = User::factory()->create();
    $organization = $owner->currentOrganization;
    $organization->invitations()->create([
        'email' => 'invitee@example.com',
        'role' => OrganizationRole::Member,
        'invited_by' => $owner->id,
    ]);

    app(DeleteOrganization::class)->handle($organization);

    expect(Organization::find($organization->id))->toBeNull()
        ->and(Organization::withTrashed()->find($organization->id))->not->toBeNull()
        ->and($organization->memberships()->count())->toBe(0)
        ->and($organization->invitations()->count())->toBe(0);
});

it('moves every user that had the organization as current to a remaining organization or none', function () {
    $owner = User::factory()->withoutOrganization()->create();
    $memberWithOtherOrganization = User::factory()->create();
    $otherOrganization = $memberWithOtherOrganization->currentOrganization;

    $organization = Organization::factory()->create();
    $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
    $organization->members()->attach($memberWithOtherOrganization, ['role' => OrganizationRole::Member->value]);
    $owner->switchOrganization($organization);
    $memberWithOtherOrganization->switchOrganization($organization);

    app(DeleteOrganization::class)->handle($organization);

    expect($owner->fresh()->current_organization_id)->toBeNull()
        ->and($memberWithOtherOrganization->fresh()->current_organization_id)->toBe($otherOrganization->id);
});

it('does not touch other organizations', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();

    app(DeleteOrganization::class)->handle($owner->currentOrganization);

    expect($other->currentOrganization->fresh())->not->toBeNull()
        ->and($other->currentOrganization->memberships()->count())->toBe(1);
});
