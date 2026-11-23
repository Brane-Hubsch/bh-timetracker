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
});

function asRole(OrganizationRole $role)
{
    $user = User::factory()->withoutOrganization()->create();
    test()->organization->members()->attach($user, ['role' => $role->value]);

    return $user;
}

it('lists active clients with search, and archived clients separately', function () {
    $acme = Client::factory()->for($this->organization)->create(['name' => 'Acme AB']);
    Client::factory()->for($this->organization)->create(['name' => 'Nordic AB']);
    $archived = Client::factory()->for($this->organization)->archived()->create(['name' => 'Old AB']);
    Client::factory()->archived()->create(['name' => 'Other organization AB']);
    Project::factory()->for($this->organization)->for($acme)->create();
    Project::factory()->for($this->organization)->for($acme)->archived()->count(2)->create();

    $this->actingAs($this->owner)
        ->get(route('clients.index', ['current_organization' => $this->slug, 'search' => 'acme']))
        ->assertInertia(fn (Assert $page) => $page
            ->component('clients/index')
            ->has('clients', 1)
            ->where('clients.0.name', 'Acme AB')
            ->where('clients.0.slug', 'acme-ab')
            ->where('clients.0.activeProjectsCount', 1)
            ->where('clients.0.archivedProjectsCount', 2)
            ->has('clientNameOptions', 3)
            ->where('clientNameOptions.0', ['id' => $acme->id, 'slug' => 'acme-ab', 'name' => 'Acme AB', 'isArchived' => false])
            ->where('clientNameOptions.2', ['id' => $archived->id, 'slug' => 'old-ab', 'name' => 'Old AB', 'isArchived' => true]));

    $this->actingAs($this->owner)
        ->get(route('clients.index', ['current_organization' => $this->slug, 'status' => 'archived']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('clients', 1)
            ->where('clients.0.name', 'Old AB')
            ->where('clients.0.activeProjectsCount', 0)
            ->where('clients.0.archivedProjectsCount', 0));
});

it('lets admins create, update, archive and restore clients', function () {
    $admin = asRole(OrganizationRole::Admin);

    $this->actingAs($admin)
        ->post(route('clients.store', ['current_organization' => $this->slug]), ['name' => 'Acme AB', 'email' => 'a@acme.example'])
        ->assertRedirect(route('clients.show', [$this->slug, 'acme-ab']));
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
        ->post(route('clients.store', ['current_organization' => $this->slug]), ['name' => '', 'email' => 'nope', 'website' => 'ftp://example.com'])
        ->assertSessionHasErrors(['name', 'email', 'website']);
});

it('shows a name validation error when creating an archived client again', function () {
    Client::factory()->for($this->organization)->archived()->create(['name' => 'Nordic Health AB']);

    $this->actingAs($this->owner)
        ->post(route('clients.store', ['current_organization' => $this->slug]), ['name' => ' nordic health ab '])
        ->assertSessionHasErrors(['name' => __('A client with this name already exists.')]);

    expect(Client::forOrganization($this->organization)->count())->toBe(1);
});

it('normalizes, presents and clears the optional website', function () {
    $this->actingAs($this->owner)
        ->post(route('clients.store', ['current_organization' => $this->slug]), ['name' => 'Acme', 'website' => ' acme.example/about '])
        ->assertRedirect();

    $client = Client::forOrganization($this->organization)->sole();
    $parameters = ['current_organization' => $this->slug, 'client' => $client->id];

    $this->patch(route('clients.update', $parameters), ['name' => 'Acme AB']);
    $this->get(route('clients.show', [...$parameters, 'client' => $client]))
        ->assertInertia(fn (Assert $page) => $page->where('client.website', 'https://acme.example/about'));

    $this->patch(route('clients.update', $parameters), ['name' => 'Acme AB', 'website' => '']);
    expect($client->fresh()->website)->toBeNull();
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
    Project::factory()->for($this->organization)->for($client)->create(['name' => 'Webbshop']);

    $this->actingAs($this->owner)
        ->get(route('clients.show', [$this->slug, $client]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('clients/show')
            ->where('client.id', $client->id)
            ->has('projects', 1)
            ->where('projects.0.slug', 'webbshop')
            // For creating a project for the client in the side drawer.
            ->where('projectForm.clients.0.value', (string) $client->id));
});

it('redirects an archived client bookmark with its report period to the same client', function () {
    $client = Client::factory()->for($this->organization)->archived()->create(['name' => 'Åkerbergs AB']);
    $query = ['period' => 'custom', 'from' => '2026-10-01', 'to' => '2026-10-31'];
    $legacy = route('clients.show', [$this->slug, $client->id, ...$query]);
    $canonical = route('clients.show', [$this->slug, 'akerbergs-ab', ...$query]);

    $this->actingAs($this->owner)->get($legacy)->assertRedirect($canonical);
    $this->get($canonical)->assertInertia(fn (Assert $page) => $page
        ->where('client.id', $client->id)
        ->where('client.isArchived', true)
        ->where('report.period', 'custom')
        ->where('report.from', '2026-10-01')
        ->where('report.to', '2026-10-31'));
});
