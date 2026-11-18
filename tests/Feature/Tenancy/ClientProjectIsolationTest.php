<?php

use App\Models\Client;
use App\Models\Project;
use App\Models\User;

/*
 * Clients and projects of another organization must never be reachable, even with known ids.
 */

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->mine = $this->owner->currentOrganization;
    $this->foreignOwner = User::factory()->create();
    $this->foreign = $this->foreignOwner->currentOrganization;
    $this->foreignClient = Client::factory()->for($this->foreign)->create(['name' => 'Foreign client']);
    $this->foreignProject = Project::factory()->for($this->foreign)->create(['name' => 'Foreign project', 'client_id' => $this->foreignClient->id]);
});

it('does not list another organization\'s clients or projects', function () {
    Client::factory()->for($this->mine)->create();

    $this->actingAs($this->owner)
        ->get(route('clients.index', ['current_organization' => $this->mine->slug]))
        ->assertInertia(fn ($page) => $page->has('clients', 1)->where('clients.0.name', fn ($name) => $name !== 'Foreign client'));

    $this->actingAs($this->owner)
        ->get(route('projects.index', ['current_organization' => $this->mine->slug]))
        ->assertInertia(fn ($page) => $page->has('projects', 0));
});

it('returns 404 for another organization\'s records through my organization\'s URLs', function () {
    $mine = ['current_organization' => $this->mine->slug];

    $this->actingAs($this->owner)->get(route('clients.show', [...$mine, 'client' => $this->foreignClient->id]))->assertNotFound();
    $this->actingAs($this->owner)->patch(route('clients.update', [...$mine, 'client' => $this->foreignClient->id]), ['name' => 'Hijacked'])->assertNotFound();
    $this->actingAs($this->owner)->post(route('clients.archive', [...$mine, 'client' => $this->foreignClient->id]))->assertNotFound();
    $this->actingAs($this->owner)->get(route('projects.show', [...$mine, 'project' => $this->foreignProject->id]))->assertNotFound();
    $this->actingAs($this->owner)->patch(route('projects.update', [...$mine, 'project' => $this->foreignProject->id]), ['name' => 'Hijacked'])->assertNotFound();
    $this->actingAs($this->owner)->post(route('projects.archive', [...$mine, 'project' => $this->foreignProject->id]))->assertNotFound();
    $this->actingAs($this->owner)->post(route('projects.members.store', [...$mine, 'project' => $this->foreignProject->id]), ['user_id' => $this->owner->id])->assertNotFound();

    expect($this->foreignClient->fresh()->name)->toBe('Foreign client')
        ->and($this->foreignProject->fresh()->name)->toBe('Foreign project')
        ->and($this->foreignProject->fresh()->isArchived())->toBeFalse()
        ->and($this->foreignProject->members()->count())->toBe(0);
});

it('refuses the other organization\'s URLs', function () {
    $theirs = ['current_organization' => $this->foreign->slug];

    $this->actingAs($this->owner)->get(route('clients.index', $theirs))->assertForbidden();
    $this->actingAs($this->owner)->get(route('projects.show', [...$theirs, 'project' => $this->foreignProject->id]))->assertForbidden();
});

it('cannot attach another organization\'s client to a project', function () {
    $this->actingAs($this->owner)
        ->post(route('projects.store', ['current_organization' => $this->mine->slug]), [
            'name' => 'Mine', 'client_id' => $this->foreignClient->id, 'color' => '#7c3aed',
            'is_billable' => true, 'visibility' => 'public',
        ])
        ->assertSessionHasErrors('client_id');
});

it('cannot assign someone outside the organization to a project', function () {
    $project = Project::factory()->for($this->mine)->create();

    $this->actingAs($this->owner)
        ->post(route('projects.members.store', ['current_organization' => $this->mine->slug, 'project' => $project->id]), ['user_id' => $this->foreignOwner->id])
        ->assertSessionHasErrors('user_id');

    expect($project->members()->count())->toBe(0);
});
