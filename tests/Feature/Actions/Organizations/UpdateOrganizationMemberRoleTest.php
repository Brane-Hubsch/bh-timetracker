<?php

use App\Actions\Organizations\UpdateOrganizationMemberRole;
use App\Enums\OrganizationRole;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;

it('changes the role of a member', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = $owner->currentOrganization;
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

    app(UpdateOrganizationMemberRole::class)->handle($organization, $member, OrganizationRole::Admin);

    expect($member->organizationRole($organization))->toBe(OrganizationRole::Admin);
});

it('fails for users outside the organization', function () {
    $owner = User::factory()->create();
    $outsider = User::factory()->create();

    app(UpdateOrganizationMemberRole::class)->handle($owner->currentOrganization, $outsider, OrganizationRole::Admin);
})->throws(ModelNotFoundException::class);

it('never changes the owner\'s role', function () {
    $owner = User::factory()->create();

    app(UpdateOrganizationMemberRole::class)->handle($owner->currentOrganization, $owner, OrganizationRole::Member);
})->throws(AuthorizationException::class);

it('never grants ownership', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $owner->currentOrganization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

    app(UpdateOrganizationMemberRole::class)->handle($owner->currentOrganization, $member, OrganizationRole::Owner);
})->throws(AuthorizationException::class);
