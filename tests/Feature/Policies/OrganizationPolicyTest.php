<?php

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;
use App\Policies\OrganizationPolicy;

function userWithRole(Organization $organization, ?OrganizationRole $role): User
{
    $user = User::factory()->withoutOrganization()->create();

    if ($role) {
        $organization->members()->attach($user, ['role' => $role->value]);
    }

    return $user;
}

dataset('abilities', [
    //                  owner, admin, member, outsider
    'view' => ['view', true, true, true, false],
    'update' => ['update', true, true, false, false],
    'delete' => ['delete', true, false, false, false],
    'addMember' => ['addMember', true, true, false, false],
    'updateMember' => ['updateMember', true, true, false, false],
    'removeMember' => ['removeMember', true, true, false, false],
    'inviteMember' => ['inviteMember', true, true, false, false],
    'cancelInvitation' => ['cancelInvitation', true, true, false, false],
    'import' => ['import', true, true, false, false],
    'leave' => ['leave', false, true, true, false],
]);

it('authorizes by role', function (string $ability, bool $owner, bool $admin, bool $member, bool $outsider) {
    $organization = Organization::factory()->create();
    $policy = new OrganizationPolicy;

    expect($policy->{$ability}(userWithRole($organization, OrganizationRole::Owner), $organization))->toBe($owner)
        ->and($policy->{$ability}(userWithRole($organization, OrganizationRole::Admin), $organization))->toBe($admin)
        ->and($policy->{$ability}(userWithRole($organization, OrganizationRole::Member), $organization))->toBe($member)
        ->and($policy->{$ability}(userWithRole($organization, null), $organization))->toBe($outsider);
})->with('abilities');

it('lets any user create an organization', function () {
    expect((new OrganizationPolicy)->create(User::factory()->withoutOrganization()->create()))->toBeTrue();
});
