<?php

use App\Models\Client;
use App\Models\Project;
use App\Models\User;

/*
 * Clients and projects of another organization must never be reachable, even with known ids or slugs.
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

    $this->actingAs($this->owner);

    foreach (['id', 'slug'] as $key) {
        $client = [...$mine, 'client' => $this->foreignClient->{$key}];
        $project = [...$mine, 'project' => $this->foreignProject->{$key}];

        $this->get(route('clients.show', $client))->assertNotFound();
        $this->patch(route('clients.update', $client), ['name' => 'Hijacked'])->assertNotFound();
        $this->post(route('clients.archive', $client))->assertNotFound();
        $this->get(route('projects.show', $project))->assertNotFound();
        $this->patch(route('projects.update', $project), ['name' => 'Hijacked'])->assertNotFound();
        $this->post(route('projects.archive', $project))->assertNotFound();
        $this->post(route('projects.members.store', $project), ['user_id' => $this->owner->id])->assertNotFound();
    }

    expect($this->foreignClient->fresh()->name)->toBe('Foreign client')
        ->and($this->foreignProject->fresh()->name)->toBe('Foreign project')
        ->and($this->foreignProject->fresh()->isArchived())->toBeFalse()
        ->and($this->foreignProject->members()->count())->toBe(0);
});

it('resolves matching slugs within the organization in the URL', function () {
    $client = Client::factory()->for($this->mine)->create(['name' => $this->foreignClient->name]);
    $project = Project::factory()->for($this->mine)->create(['name' => $this->foreignProject->name]);

    $this->actingAs($this->owner)
        ->get(route('clients.show', [$this->mine->slug, $this->foreignClient->slug]))
        ->assertInertia(fn ($page) => $page->where('client.id', $client->id));
    $this->get(route('projects.show', [$this->mine->slug, $this->foreignProject->slug]))
        ->assertInertia(fn ($page) => $page->where('project.id', $project->id));
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
