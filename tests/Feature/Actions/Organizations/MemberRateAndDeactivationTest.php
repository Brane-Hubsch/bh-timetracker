<?php

use App\Actions\Organizations\SetOrganizationMemberActive;
use App\Actions\Organizations\UpdateOrganizationMemberRate;
use App\Enums\OrganizationRole;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->create();
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
});

it('sets and clears a member\'s hourly rate', function () {
    $action = app(UpdateOrganizationMemberRate::class);

    expect($action->handle($this->organization, $this->member, 90000)->hourly_rate)->toBe(90000)
        ->and($action->handle($this->organization, $this->member, null)->hourly_rate)->toBeNull();
});

it('deactivates a member: no access, no role, history kept', function () {
    $this->member->switchOrganization($this->organization);

    app(SetOrganizationMemberActive::class)->handle($this->organization, $this->member, false);

    $member = $this->member->fresh();
    expect($member->belongsToOrganization($this->organization))->toBeFalse()
        ->and($member->organizationRole($this->organization))->toBeNull()
        ->and($member->current_organization_id)->not->toBe($this->organization->id)
        ->and($this->organization->memberships()->where('user_id', $member->id)->exists())->toBeTrue();

    $this->actingAs($member)
        ->get(route('dashboard', ['current_organization' => $this->organization->slug]))
        ->assertForbidden();
});

it('reactivates a member', function () {
    $action = app(SetOrganizationMemberActive::class);
    $action->handle($this->organization, $this->member, false);

    $action->handle($this->organization, $this->member, true);

    expect($this->member->fresh()->organizationRole($this->organization))->toBe(OrganizationRole::Member);
});

it('never deactivates the owner', function () {
    app(SetOrganizationMemberActive::class)->handle($this->organization, $this->owner, false);
})->throws(AuthorizationException::class);
