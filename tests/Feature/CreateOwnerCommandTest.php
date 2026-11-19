<?php

use App\Enums\OrganizationRole;
use App\Models\User;
use App\Notifications\Auth\MagicLinkNotification;
use Illuminate\Support\Facades\Notification;

it('creates the first owner and organization and emails a sign-in link', function () {
    Notification::fake();

    $this->artisan('app:create-owner', ['email' => 'Albin@Example.com', 'name' => 'Albin', 'organization' => 'Brane Hubsch'])
        ->assertSuccessful();

    $user = User::where('email', 'albin@example.com')->sole();
    expect($user->password)->toBeNull()
        ->and($user->hasVerifiedEmail())->toBeTrue()
        ->and($user->currentOrganization->name)->toBe('Brane Hubsch')
        ->and($user->organizationRole($user->currentOrganization))->toBe(OrganizationRole::Owner);
    Notification::assertSentTo($user, MagicLinkNotification::class);
});

it('refuses an existing email address', function () {
    User::factory()->create(['email' => 'albin@example.com']);

    $this->artisan('app:create-owner', ['email' => 'albin@example.com', 'name' => 'Albin', 'organization' => 'X'])
        ->assertFailed();

    expect(User::count())->toBe(1);
});
