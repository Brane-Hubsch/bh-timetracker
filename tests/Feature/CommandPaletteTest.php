<?php

use App\Enums\OrganizationRole;
use App\Models\Client;
use App\Models\Organization;
use App\Models\Project;
use App\Models\User;

beforeEach(function () {
    $this->owner = User::factory()->create(['name' => 'Olivia Owner']);
    $this->organization = $this->owner->currentOrganization;
    $this->member = User::factory()->withoutOrganization()->create(['name' => 'Mia Member']);
    $this->organization->members()->attach($this->member, ['role' => OrganizationRole::Member->value]);
    $this->client = Client::factory()->for($this->organization)->create(['name' => 'Acme']);
    Project::factory()->for($this->organization)->create(['name' => 'Webbshop', 'client_id' => $this->client->id]);
    Project::factory()->for($this->organization)->private()->create(['name' => 'Hemligt']);
    Project::factory()->for($this->organization)->archived()->create(['name' => 'Gammalt']);
});

function paletteUrl(): string
{
    return route('command-palette', ['current_organization' => test()->organization->slug]);
}

it('gives owners projects, clients and members', function () {
    $this->actingAs($this->owner)
        ->getJson(paletteUrl())
        ->assertOk()
        ->assertJsonPath('projects.*.name', ['Hemligt', 'Webbshop'])
        ->assertJsonPath('projects.1.clientName', 'Acme')
        ->assertJsonPath('clients.*.name', ['Acme'])
        ->assertJsonPath('members.*.name', ['Mia Member', 'Olivia Owner']);
});

it('gives members only the projects they can access', function () {
    $this->actingAs($this->member)
        ->getJson(paletteUrl())
        ->assertOk()
        ->assertJsonPath('projects.*.name', ['Webbshop'])
        ->assertJsonPath('clients', [])
        ->assertJsonPath('members', []);
});

it('never includes other organizations', function () {
    $other = Organization::factory()->create();
    Project::factory()->for($other)->create(['name' => 'Annans projekt']);
    Client::factory()->for($other)->create(['name' => 'Annans kund']);

    $this->actingAs($this->owner)
        ->getJson(paletteUrl())
        ->assertJsonMissing(['name' => 'Annans projekt'])
        ->assertJsonMissing(['name' => 'Annans kund']);

    $outsider = User::factory()->create();

    $this->actingAs($outsider)->getJson(paletteUrl())->assertForbidden();
});
