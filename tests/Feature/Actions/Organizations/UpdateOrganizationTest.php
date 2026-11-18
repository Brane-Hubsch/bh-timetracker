<?php

use App\Actions\Organizations\UpdateOrganization;
use App\Models\Organization;

it('updates the name and settings', function () {
    $organization = Organization::factory()->create(['name' => 'Old Name']);

    $updated = app(UpdateOrganization::class)->handle($organization, [
        'name' => 'New Name',
        'currency' => 'NOK',
        'default_hourly_rate' => 99000,
        'week_starts_on' => 7,
        'timezone' => 'Europe/Oslo',
    ]);

    expect($updated->name)->toBe('New Name')
        ->and($updated->slug)->toBe('new-name')
        ->and($updated->currency)->toBe('NOK')
        ->and($updated->default_hourly_rate)->toBe(99000)
        ->and($updated->week_starts_on)->toBe(7)
        ->and($updated->timezone)->toBe('Europe/Oslo');
});

it('can clear the default hourly rate', function () {
    $organization = Organization::factory()->create(['default_hourly_rate' => 100000]);

    $updated = app(UpdateOrganization::class)->handle($organization, ['default_hourly_rate' => null]);

    expect($updated->default_hourly_rate)->toBeNull();
});
