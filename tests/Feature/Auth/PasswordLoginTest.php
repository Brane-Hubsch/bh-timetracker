<?php

use App\Models\User;
use App\Support\SignInOptions;

it('is enabled in tests and local development', function () {
    $user = User::factory()->create();

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password']);

    $this->assertAuthenticatedAs($user);
});

it('is disabled when turned off in config', function () {
    config(['auth.password_login' => false]);
    $user = User::factory()->create();

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])
        ->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('is never available in production', function () {
    config(['auth.password_login' => true]);
    $this->app['env'] = 'production';

    expect(app(SignInOptions::class)->passwordLogin())->toBeFalse();
});

it('cannot be used by passwordless accounts', function () {
    $user = User::factory()->passwordless()->create();

    $this->post(route('login.store'), ['email' => $user->email, 'password' => '']);
    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password']);

    $this->assertGuest();
});

it('shows the sign-in options on the login page', function () {
    $this->get(route('login'))
        ->assertInertia(fn ($page) => $page
            ->component('auth/login')
            ->where('signInOptions.passwordLogin', true)
            ->where('signInOptions.openRegistration', false)
            ->where('signInOptions.google', false));
});

it('has no password reset, registration with password or two-factor routes', function () {
    foreach (['password.request', 'password.email', 'password.reset', 'password.update', 'two-factor.login', 'two-factor.enable', 'user-password.update'] as $name) {
        expect(Route::has($name))->toBeFalse("Route [{$name}] should not exist.");
    }
});
