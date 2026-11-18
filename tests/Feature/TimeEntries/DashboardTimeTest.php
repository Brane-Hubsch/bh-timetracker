<?php

use App\Enums\OrganizationRole;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    CarbonImmutable::setTestNow('2026-11-18 12:00:00');

    $this->owner = User::factory()->create(['name' => 'Olivia Owner']);
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Mia Member']);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->project = Project::factory()->for($this->organization)->create(['estimate_seconds' => 10 * 3600]);
    $this->other = Project::factory()->for($this->organization)->create(['estimate_seconds' => 100 * 3600]);

    $add = fn (User $user, Project $project, string $start, int $hours) => TimeEntry::factory()->by($user, $project)
        ->between(CarbonImmutable::parse($start, 'UTC'), CarbonImmutable::parse($start, 'UTC')->addHours($hours))->create();

    $add($this->member, $this->project, '2026-11-18 07:00', 2);
    $add($this->member, $this->project, '2026-11-16 07:00', 3);
    $add($this->member, $this->project, '2026-11-09 07:00', 4);
    $add($this->owner, $this->other, '2026-11-17 07:00', 1);
});

afterEach(fn () => CarbonImmutable::setTestNow());

it('shows members their own time today and this week', function () {
    $this->actingAs($this->member)
        ->get(route('dashboard', ['current_organization' => $this->organization->slug]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('today', '2026-11-18')
            ->where('todaySeconds', 2 * 3600)
            ->where('weekSeconds', 5 * 3600)
            ->has('recentEntries', 3)
            ->where('team', null)
            ->where('projectsNearEstimate', null));
});

it('shows owners and admins the team week and projects near their estimate', function () {
    $this->actingAs($this->owner)
        ->get(route('dashboard', ['current_organization' => $this->organization->slug]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('weekSeconds', 3600)
            ->has('team', 2)
            ->where('team.0.name', 'Mia Member')
            ->where('team.0.seconds', 5 * 3600)
            ->where('team.1.seconds', 3600)
            ->has('projectsNearEstimate', 1)
            ->where('projectsNearEstimate.0.id', $this->project->id)
            ->where('projectsNearEstimate.0.consumedSeconds', 9 * 3600));
});

it('shows consumed time on the project page', function () {
    $this->actingAs($this->owner)
        ->get(route('projects.show', ['current_organization' => $this->organization->slug, 'project' => $this->project->id]))
        ->assertInertia(fn (Assert $page) => $page->where('project.consumedSeconds', 9 * 3600));
});
