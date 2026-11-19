<?php

use App\Actions\Organizations\CreateOrganization;
use App\Enums\OrganizationRole;
use App\Models\User;

it('creates an organization with the user as owner and makes it current', function () {
    $user = User::factory()->withoutOrganization()->create();

    $organization = app(CreateOrganization::class)->handle($user, 'Brane Hubsch');

    expect($organization->name)->toBe('Brane Hubsch')
        ->and($organization->slug)->toBe('brane-hubsch')
        ->and($user->organizationRole($organization))->toBe(OrganizationRole::Owner)
        ->and($user->fresh()->current_organization_id)->toBe($organization->id);
});

it('applies default settings', function () {
    $user = User::factory()->withoutOrganization()->create();

    $organization = app(CreateOrganization::class)->handle($user, 'Acme');

    expect($organization->currency)->toBe('SEK')
        ->and($organization->default_hourly_rate)->toBeNull()
        ->and($organization->week_starts_on)->toBe(1)
        ->and($organization->timezone)->toBe('Europe/Stockholm');
});

it('accepts custom settings', function () {
    $user = User::factory()->withoutOrganization()->create();

    $organization = app(CreateOrganization::class)->handle($user, 'Acme', [
        'currency' => 'EUR',
        'default_hourly_rate' => 120000,
        'week_starts_on' => 7,
        'timezone' => 'Europe/Helsinki',
    ]);

    expect($organization->currency)->toBe('EUR')
        ->and($organization->default_hourly_rate)->toBe(120000)
        ->and($organization->week_starts_on)->toBe(7)
        ->and($organization->timezone)->toBe('Europe/Helsinki');
});

it('generates unique slugs for organizations with the same name', function () {
    $user = User::factory()->withoutOrganization()->create();
    $action = app(CreateOrganization::class);

    $first = $action->handle($user, 'Acme');
    $second = $action->handle($user, 'Acme');

    expect($first->slug)->not->toBe($second->slug);
});
