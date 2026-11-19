<?php

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    $this->author = User::factory()->withoutOrganization()->create();
    $this->organization->members()->attach($this->author, ['role' => OrganizationRole::Member->value]);
    $this->entry = TimeEntry::factory()->by($this->author, Project::factory()->for($this->organization)->create())->create();
});

it('authorizes time entries for the author, owners and admins', function (string $who, bool $allowed) {
    $user = match ($who) {
        'author' => $this->author,
        'owner' => $this->owner,
        'outsider' => User::factory()->create(),
        default => tap(User::factory()->withoutOrganization()->create(), fn (User $user) => $this->organization->members()->attach($user, ['role' => $who])),
    };

    foreach (['view', 'update', 'delete', 'restore'] as $ability) {
        expect($user->can($ability, $this->entry))->toBe($allowed, $ability);
    }

    expect($user->can('manageFor', [TimeEntry::class, $this->organization, $this->author]))->toBe($allowed);
})->with([
    ['author', true],
    ['owner', true],
    [OrganizationRole::Admin->value, true],
    [OrganizationRole::Member->value, false],
    ['outsider', false],
]);

it('denies deactivated authors and admins', function () {
    $admin = User::factory()->withoutOrganization()->create();
    $this->organization->members()->attach($admin, ['role' => OrganizationRole::Admin->value, 'deactivated_at' => now()]);
    $this->organization->memberships()->where('user_id', $this->author->id)->update(['deactivated_at' => now()]);

    expect($admin->can('update', $this->entry))->toBeFalse()
        ->and($this->author->fresh()->can('update', $this->entry))->toBeFalse();
});

it('does not let admins of another organization manage members', function () {
    $otherAdmin = User::factory()->withoutOrganization()->create();
    Organization::factory()->create()->members()->attach($otherAdmin, ['role' => OrganizationRole::Owner->value]);

    expect($otherAdmin->can('manageFor', [TimeEntry::class, $this->organization, $this->author]))->toBeFalse()
        ->and($otherAdmin->can('view', $this->entry))->toBeFalse();
});
