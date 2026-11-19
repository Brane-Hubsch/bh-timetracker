<?php

use App\Models\Project;
use App\Models\User;
use App\Support\RateResolver;

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    $this->organization->update(['default_hourly_rate' => 80000]);
    $this->member = User::factory()->create();
    $this->organization->members()->attach($this->member, ['role' => 'member', 'hourly_rate' => 90000]);
    $this->project = Project::factory()->for($this->organization)->create(['hourly_rate' => 100000]);
    $this->project->members()->attach($this->member, ['hourly_rate' => 110000]);
});

it('uses the project member rate first', function () {
    expect(app(RateResolver::class)->resolve($this->project, $this->member))->toBe(110000);
});

it('falls back to the project rate', function () {
    $this->project->members()->updateExistingPivot($this->member->id, ['hourly_rate' => null]);

    expect(app(RateResolver::class)->resolve($this->project, $this->member))->toBe(100000);
});

it('falls back to the member\'s organization rate', function () {
    $this->project->members()->detach($this->member->id);
    $this->project->update(['hourly_rate' => null]);

    expect(app(RateResolver::class)->resolve($this->project, $this->member))->toBe(90000);
});

it('falls back to the organization default', function () {
    $this->project->members()->detach($this->member->id);
    $this->project->update(['hourly_rate' => null]);
    $this->organization->memberships()->where('user_id', $this->member->id)->update(['hourly_rate' => null]);

    expect(app(RateResolver::class)->resolve($this->project, $this->member))->toBe(80000);
});

it('returns null when no rate is set anywhere', function () {
    $this->organization->update(['default_hourly_rate' => null]);
    $project = Project::factory()->for($this->organization)->create();

    expect(app(RateResolver::class)->resolve($project, $this->owner))->toBeNull();
});
