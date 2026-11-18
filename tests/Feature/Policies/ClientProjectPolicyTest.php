<?php

use App\Enums\OrganizationRole;
use App\Models\Client;
use App\Models\Project;
use App\Models\User;
use App\Support\CurrentOrganization;

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    app(CurrentOrganization::class)->set($this->organization);
});

function memberWith(?OrganizationRole $role): User
{
    $user = User::factory()->withoutOrganization()->create();

    if ($role) {
        test()->organization->members()->attach($user, ['role' => $role->value]);
    }

    return $user;
}

it('authorizes client management for owners and admins only', function (?OrganizationRole $role, bool $allowed) {
    $user = $role === OrganizationRole::Owner ? $this->owner : memberWith($role);
    $client = Client::factory()->for($this->organization)->create();

    expect($user->can('viewAny', Client::class))->toBe($allowed)
        ->and($user->can('create', Client::class))->toBe($allowed)
        ->and($user->can('view', $client))->toBe($allowed)
        ->and($user->can('update', $client))->toBe($allowed);
})->with([
    'owner' => [OrganizationRole::Owner, true],
    'admin' => [OrganizationRole::Admin, true],
    'member' => [OrganizationRole::Member, false],
    'outsider' => [null, false],
]);

it('authorizes projects', function (?OrganizationRole $role, bool $manage, bool $viewPrivate) {
    $user = $role === OrganizationRole::Owner ? $this->owner : memberWith($role);
    $public = Project::factory()->for($this->organization)->create();
    $private = Project::factory()->for($this->organization)->private()->create();

    expect($user->can('create', Project::class))->toBe($manage)
        ->and($user->can('update', $public))->toBe($manage)
        ->and($user->can('view', $public))->toBe($role !== null)
        ->and($user->can('view', $private))->toBe($viewPrivate)
        ->and($user->can('viewAny', Project::class))->toBe($role !== null)
        ->and($user->can('viewRates', $this->organization))->toBe($manage);
})->with([
    'owner' => [OrganizationRole::Owner, true, true],
    'admin' => [OrganizationRole::Admin, true, true],
    'member' => [OrganizationRole::Member, false, false],
    'outsider' => [null, false, false],
]);

it('treats deactivated members as outsiders', function () {
    $user = User::factory()->withoutOrganization()->create();
    $this->organization->members()->attach($user, ['role' => 'admin', 'deactivated_at' => now()]);

    expect($user->can('view', Project::factory()->for($this->organization)->create()))->toBeFalse()
        ->and($user->can('viewAny', Client::class))->toBeFalse();
});
