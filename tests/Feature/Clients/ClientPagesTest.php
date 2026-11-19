<?php

use App\Enums\OrganizationRole;
use App\Models\Client;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->owner = User::factory()->create();
    $this->organization = $this->owner->currentOrganization;
    $this->slug = $this->organization->slug;
});

function asRole(OrganizationRole $role)
{
    $user = User::factory()->withoutOrganization()->create();
    test()->organization->members()->attach($user, ['role' => $role->value]);

    return $user;
}

it('lists active clients with search, and archived clients separately', function () {
    Client::factory()->for($this->organization)->create(['name' => 'Acme AB']);
    Client::factory()->for($this->organization)->create(['name' => 'Nordic AB']);
    Client::factory()->for($this->organization)->archived()->create(['name' => 'Old AB']);

    $this->actingAs($this->owner)
        ->get(route('clients.index', ['current_organization' => $this->slug, 'search' => 'acme']))
        ->assertInertia(fn (Assert $page) => $page
            ->component('clients/index')
            ->has('clients', 1)
            ->where('clients.0.name', 'Acme AB'));

    $this->actingAs($this->owner)
        ->get(route('clients.index', ['current_organization' => $this->slug, 'status' => 'archived']))
        ->assertInertia(fn (Assert $page) => $page->has('clients', 1)->where('clients.0.name', 'Old AB'));
});

it('lets admins create, update, archive and restore clients', function () {
    $admin = asRole(OrganizationRole::Admin);

    $this->actingAs($admin)
        ->post(route('clients.store', ['current_organization' => $this->slug]), ['name' => 'Acme AB', 'email' => 'a@acme.example'])
        ->assertRedirect();
    $client = Client::forOrganization($this->organization)->sole();

    $this->actingAs($admin)
        ->patch(route('clients.update', ['current_organization' => $this->slug, 'client' => $client->id]), ['name' => 'Acme Retail AB'])
        ->assertRedirect();
    $this->actingAs($admin)->post(route('clients.archive', ['current_organization' => $this->slug, 'client' => $client->id]));

    expect($client->fresh()->name)->toBe('Acme Retail AB')
        ->and($client->fresh()->isArchived())->toBeTrue();

    $this->actingAs($admin)->post(route('clients.restore', ['current_organization' => $this->slug, 'client' => $client->id]));
    expect($client->fresh()->isArchived())->toBeFalse();
});

it('validates client input', function () {
    $this->actingAs($this->owner)
        ->post(route('clients.store', ['current_organization' => $this->slug]), ['name' => '', 'email' => 'nope'])
        ->assertSessionHasErrors(['name', 'email']);
});

it('keeps members out of client management', function () {
    $member = asRole(OrganizationRole::Member);
    $client = Client::factory()->for($this->organization)->create();

    $this->actingAs($member)->get(route('clients.index', ['current_organization' => $this->slug]))->assertForbidden();
    $this->actingAs($member)->get(route('clients.show', ['current_organization' => $this->slug, 'client' => $client->id]))->assertForbidden();
    $this->actingAs($member)->post(route('clients.store', ['current_organization' => $this->slug]), ['name' => 'X'])->assertForbidden();
    $this->actingAs($member)->patch(route('clients.update', ['current_organization' => $this->slug, 'client' => $client->id]), ['name' => 'X'])->assertForbidden();
    $this->actingAs($member)->post(route('clients.archive', ['current_organization' => $this->slug, 'client' => $client->id]))->assertForbidden();

    expect($client->fresh()->name)->not->toBe('X')
        ->and($client->fresh()->isArchived())->toBeFalse();
});

it('shows a client with its projects', function () {
    $client = Client::factory()->for($this->organization)->create();
    $client->projects()->create(['organization_id' => $this->organization->id, 'name' => 'Webbshop', 'color' => '#7c3aed']);

    $this->actingAs($this->owner)
        ->get(route('clients.show', ['current_organization' => $this->slug, 'client' => $client->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('clients/show')
            ->where('client.id', $client->id)
            ->has('projects', 1)
            // For creating a project for the client in the side drawer.
            ->where('projectForm.clients.0.value', (string) $client->id));
});
