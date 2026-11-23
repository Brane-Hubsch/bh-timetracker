<?php

use App\Actions\Clients\CreateClient;
use App\Actions\Clients\SetClientArchived;
use App\Actions\Clients\UpdateClient;
use App\Models\Client;
use App\Models\Organization;
use App\Models\Project;

it('creates a client in the given organization', function () {
    $organization = Organization::factory()->create();

    $client = app(CreateClient::class)->handle($organization, [
        'name' => 'Acme AB',
        'organization_number' => '556677-8899',
        'email' => 'info@acme.example',
        'notes' => null,
    ]);

    expect($client->organization_id)->toBe($organization->id)
        ->and($client->name)->toBe('Acme AB')
        ->and($client->slug)->toBe('acme-ab')
        ->and($client->isArchived())->toBeFalse();
});

it('reserves archived slugs and generates unique non-numeric slugs per organization', function () {
    $organization = Organization::factory()->create();
    $create = app(CreateClient::class);
    $original = $create->handle($organization, ['name' => 'Åkerbergs AB']);
    app(SetClientArchived::class)->handle($original, true);

    expect($original->slug)->toBe('akerbergs-ab')
        ->and($create->handle($organization, ['name' => 'Akerbergs AB'])->slug)->toBe('akerbergs-ab-2')
        ->and($create->handle(Organization::factory()->create(), ['name' => 'Åkerbergs AB'])->slug)->toBe('akerbergs-ab')
        ->and($create->handle($organization, ['name' => '123'])->slug)->toBe('client-123')
        ->and($create->handle($organization, ['name' => '✨'])->slug)->toBe('client');
});

it('updates a client', function () {
    $client = Client::factory()->create(['name' => 'Old']);

    app(UpdateClient::class)->handle($client, ['name' => 'New', 'notes' => 'VIP']);

    expect($client->fresh()->name)->toBe('New')
        ->and($client->fresh()->slug)->toBe('old')
        ->and($client->fresh()->notes)->toBe('VIP');
});

it('archives and restores a client without touching its projects', function () {
    $client = Client::factory()->create();
    $project = Project::factory()->for($client->organization)->for($client)->create();

    app(SetClientArchived::class)->handle($client, true);
    expect($client->fresh()->isArchived())->toBeTrue()
        ->and($project->fresh()->isArchived())->toBeFalse();

    app(SetClientArchived::class)->handle($client, false);
    expect($client->fresh()->isArchived())->toBeFalse();
});

it('keeps the original archive date when archiving twice', function () {
    $client = Client::factory()->archived()->create(['archived_at' => '2026-01-01 10:00:00']);

    app(SetClientArchived::class)->handle($client, true);

    expect($client->fresh()->archived_at->toDateString())->toBe('2026-01-01');
});
