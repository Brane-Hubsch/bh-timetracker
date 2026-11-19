<?php

use App\Enums\OrganizationRole;
use App\Models\Tag;
use App\Models\User;

it('lets owners and admins manage tags, not members or outsiders', function (?OrganizationRole $role, bool $allowed) {
    $owner = User::factory()->create();
    $organization = $owner->currentOrganization;
    $user = $owner;

    if ($role !== OrganizationRole::Owner) {
        $user = User::factory()->withoutOrganization()->create();

        if ($role) {
            $organization->members()->attach($user, ['role' => $role->value]);
        }
    }

    $tag = Tag::factory()->for($organization)->create();

    expect($user->can('manage', [Tag::class, $organization]))->toBe($allowed)
        ->and($user->can('update', $tag))->toBe($allowed)
        ->and($user->can('delete', $tag))->toBe($allowed);
})->with([
    'owner' => [OrganizationRole::Owner, true],
    'admin' => [OrganizationRole::Admin, true],
    'member' => [OrganizationRole::Member, false],
    'outsider' => [null, false],
]);

it('does not let admins manage another organization\'s tags', function () {
    $admin = User::factory()->create();
    $foreign = Tag::factory()->create();

    expect($admin->can('update', $foreign))->toBeFalse()
        ->and($admin->can('delete', $foreign))->toBeFalse();
});
