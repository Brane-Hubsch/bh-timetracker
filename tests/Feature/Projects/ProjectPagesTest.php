<?php

use App\Enums\OrganizationRole;
use App\Models\Client;
use App\Models\Project;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    $this->slug = $this->organization->slug;
    $this->member = User::factory()->withoutOrganization()->create();
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
});

function projectPayload(array $overrides = []): array
{
    return [
        'name' => 'Webbshop',
        'client_id' => null,
        'code' => 'WEB',
        'color' => '#7C3AED',
        'is_billable' => true,
        'hourly_rate' => 110000,
        'estimate_hours' => 12.5,
        'visibility' => 'public',
        'starts_on' => null,
        'ends_on' => null,
        ...$overrides,
    ];
}

it('lists accessible projects only for members', function () {
    Project::factory()->for($this->organization)->create(['name' => 'Public']);
    $assigned = Project::factory()->for($this->organization)->private()->create(['name' => 'Assigned']);
    $assigned->members()->attach($this->member);
    Project::factory()->for($this->organization)->private()->create(['name' => 'Secret']);

    $this->actingAs($this->member)
        ->get(route('projects.index', ['current_organization' => $this->slug]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('projects/index')
            ->has('projects', 2)
            ->where('projects.0.name', 'Assigned')
            ->where('projects.1.name', 'Public'));

    $this->actingAs($this->owner)
        ->get(route('projects.index', ['current_organization' => $this->slug]))
        ->assertInertia(fn (Assert $page) => $page->has('projects', 3));
});

it('filters by search, client and status', function () {
    $client = Client::factory()->for($this->organization)->create(['name' => 'Acme']);
    Project::factory()->for($this->organization)->create(['name' => 'Webbshop', 'client_id' => $client->id]);
    Project::factory()->for($this->organization)->create(['name' => 'Intern']);
    Project::factory()->for($this->organization)->archived()->create(['name' => 'Gammalt']);

    $get = fn (array $query) => $this->actingAs($this->owner)->get(route('projects.index', ['current_organization' => $this->slug, ...$query]));

    $get(['search' => 'acme'])->assertInertia(fn (Assert $page) => $page->has('projects', 1)->where('projects.0.name', 'Webbshop'));
    $get(['client' => $client->id])->assertInertia(fn (Assert $page) => $page->has('projects', 1));
    $get(['status' => 'archived'])->assertInertia(fn (Assert $page) => $page->has('projects', 1)->where('projects.0.name', 'Gammalt'));
});

it('lets owners and admins create projects', function () {
    $this->actingAs($this->owner)
        ->post(route('projects.store', ['current_organization' => $this->slug]), projectPayload())
        ->assertRedirect();

    $project = Project::forOrganization($this->organization)->sole();
    expect($project->color)->toBe('#7c3aed')
        ->and($project->estimate_seconds)->toBe(45000)
        ->and($project->hourly_rate)->toBe(110000);
});

it('validates project input', function () {
    Project::factory()->for($this->organization)->create(['code' => 'WEB']);
    $foreignClient = Client::factory()->create();

    $this->actingAs($this->owner)
        ->post(route('projects.store', ['current_organization' => $this->slug]), projectPayload([
            'name' => '',
            'code' => 'WEB',
            'color' => 'purple',
            'client_id' => $foreignClient->id,
            'visibility' => 'secret',
            'starts_on' => '2026-12-01',
            'ends_on' => '2026-11-01',
        ]))
        ->assertSessionHasErrors(['name', 'code', 'color', 'client_id', 'visibility', 'ends_on']);
});

it('allows the same code in different organizations', function () {
    Project::factory()->create(['code' => 'WEB']);

    $this->actingAs($this->owner)
        ->post(route('projects.store', ['current_organization' => $this->slug]), projectPayload(['code' => 'WEB']))
        ->assertSessionHasNoErrors();
});

it('keeps members from managing projects', function () {
    $project = Project::factory()->for($this->organization)->create();
    $route = fn (string $name, array $extra = []) => route($name, ['current_organization' => $this->slug, 'project' => $project->id, ...$extra]);

    $this->actingAs($this->member)->get(route('projects.create', ['current_organization' => $this->slug]))->assertForbidden();
    $this->actingAs($this->member)->post(route('projects.store', ['current_organization' => $this->slug]), projectPayload())->assertForbidden();
    $this->actingAs($this->member)->get($route('projects.edit'))->assertForbidden();
    $this->actingAs($this->member)->patch($route('projects.update'), projectPayload())->assertForbidden();
    $this->actingAs($this->member)->post($route('projects.archive'))->assertForbidden();
    $this->actingAs($this->member)->post($route('projects.members.store'), ['user_id' => $this->member->id])->assertForbidden();

    expect($project->fresh()->isArchived())->toBeFalse()
        ->and($project->members()->count())->toBe(0);
});

it('hides private projects from members who are not assigned', function () {
    $project = Project::factory()->for($this->organization)->private()->create();

    $this->actingAs($this->member)
        ->get(route('projects.show', ['current_organization' => $this->slug, 'project' => $project->id]))
        ->assertForbidden();

    $project->members()->attach($this->member);

    $this->actingAs($this->member)
        ->get(route('projects.show', ['current_organization' => $this->slug, 'project' => $project->id]))
        ->assertOk();
});

it('hides rates from members', function () {
    $project = Project::factory()->for($this->organization)->create(['hourly_rate' => 100000]);
    $project->members()->attach($this->member, ['hourly_rate' => 90000]);

    $this->actingAs($this->member)
        ->get(route('projects.show', ['current_organization' => $this->slug, 'project' => $project->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('project.hourlyRate', null)
            ->where('members.0.hourlyRate', null)
            ->where('abilities.viewRates', false)
            ->where('abilities.manage', false)
            ->where('assignableMembers', []));

    $this->actingAs($this->owner)
        ->get(route('projects.show', ['current_organization' => $this->slug, 'project' => $project->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('project.hourlyRate', 100000)
            ->where('members.0.hourlyRate', 90000)
            ->has('assignableMembers', 1));
});

it('assigns, re-rates and unassigns project members', function () {
    $project = Project::factory()->for($this->organization)->create();
    $params = ['current_organization' => $this->slug, 'project' => $project->id];

    $this->actingAs($this->owner)
        ->post(route('projects.members.store', $params), ['user_id' => $this->member->id, 'hourly_rate' => 95000])
        ->assertSessionHasNoErrors();
    expect($project->members()->first()->assignment->hourly_rate)->toBe(95000);

    $this->actingAs($this->owner)
        ->patch(route('projects.members.update', [...$params, 'user' => $this->member->id]), ['hourly_rate' => null]);
    expect($project->members()->first()->assignment->hourly_rate)->toBeNull();

    $this->actingAs($this->owner)->delete(route('projects.members.destroy', [...$params, 'user' => $this->member->id]));
    expect($project->members()->count())->toBe(0);
});

it('lets admins set member rates and deactivate members, but not members', function () {
    $params = ['organization' => $this->organization->slug, 'user' => $this->member->id];

    $this->actingAs($this->owner)->patch(route('organizations.members.rate', $params), ['hourly_rate' => 85000]);
    $this->actingAs($this->owner)->post(route('organizations.members.deactivate', $params));

    $membership = $this->organization->memberships()->where('user_id', $this->member->id)->sole();
    expect($membership->hourly_rate)->toBe(85000)
        ->and($membership->isDeactivated())->toBeTrue();

    $other = User::factory()->withoutOrganization()->create();
    $this->organization->members()->attach($other, ['role' => 'member']);
    $this->actingAs($other)->post(route('organizations.members.reactivate', $params))->assertForbidden();
    $this->actingAs($other)->patch(route('organizations.members.rate', $params), ['hourly_rate' => 1])->assertForbidden();
});
