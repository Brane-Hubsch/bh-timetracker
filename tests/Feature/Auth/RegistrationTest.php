<?php

use App\Models\User;
use App\Notifications\Auth\MagicLinkNotification;
use Illuminate\Support\Facades\Notification;

it('is not available when registration is closed (default)', function () {
    $this->get(route('register'))->assertNotFound();
    $this->post(route('register.store'), ['name' => 'Anna', 'email' => 'anna@example.com'])->assertNotFound();

    expect(User::count())->toBe(0);
});

describe('with open registration', function () {
    beforeEach(fn () => config(['auth.open_registration' => true]));

    it('shows the registration page', function () {
        $this->get(route('register'))->assertOk();
    });

    it('creates a passwordless, unverified account and emails a sign-in link', function () {
        Notification::fake();

        $this->post(route('register.store'), ['name' => 'Anna Andersson', 'email' => 'Anna@Example.com'])
            ->assertSessionHas('status');

        $user = User::where('email', 'anna@example.com')->sole();
        expect($user->password)->toBeNull()
            ->and($user->hasVerifiedEmail())->toBeFalse()
            ->and($user->organizations)->toHaveCount(0);
        $this->assertGuest();
        Notification::assertSentTo($user, MagicLinkNotification::class);
    });

    it('sends a sign-in link instead of creating a duplicate for an existing address', function () {
        Notification::fake();
        $existing = User::factory()->create(['email' => 'anna@example.com', 'name' => 'Original']);

        $this->post(route('register.store'), ['name' => 'Someone Else', 'email' => 'anna@example.com']);

        expect(User::count())->toBe(1)
            ->and($existing->fresh()->name)->toBe('Original');
        Notification::assertSentTo($existing, MagicLinkNotification::class);
    });

    it('validates the input', function () {
        $this->post(route('register.store'), ['name' => '', 'email' => 'not-an-email'])
            ->assertSessionHasErrors(['name', 'email']);
    });
});
