<?php

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;

it('renews the web session for fourteen days from the last request', function (): void {
    $this->withoutVite();
    config(['session.driver' => 'database', 'auth.password_login' => true]);
    $user = User::factory()->create();
    $sessionName = config()->string('session.cookie');
    $signedInAt = now()->startOfSecond();
    $this->travelTo($signedInAt);

    $login = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
        'remember' => true,
    ])->assertRedirect()->assertCookieExpired(Auth::getRecallerName());

    $sessionCookie = $login->getCookie($sessionName);
    expect($sessionCookie->getExpiresTime())->toBe($signedInAt->addDays(14)->timestamp);

    Auth::forgetGuards();
    Session::flush();
    $lastActiveAt = $signedInAt->addDays(13);
    $this->travelTo($lastActiveAt);

    $active = $this->withCookie($sessionName, $sessionCookie->getValue())
        ->get(route('profile.edit'))
        ->assertOk();

    $renewedCookie = $active->getCookie($sessionName);
    expect($renewedCookie->getExpiresTime())->toBe($lastActiveAt->addDays(14)->timestamp);
    $this->assertDatabaseHas('sessions', [
        'id' => $renewedCookie->getValue(),
        'user_id' => $user->id,
        'last_activity' => $lastActiveAt->timestamp,
    ]);

    Auth::forgetGuards();
    Session::flush();
    $this->travelTo($lastActiveAt->addDays(14)->addSecond());

    $this->withCookie($sessionName, $renewedCookie->getValue())
        ->get(route('profile.edit'))
        ->assertRedirect(route('login'));
});

it('clears legacy remember cookies without restoring a sign-in', function (): void {
    $user = User::factory()->create();
    $cookie = Auth::getRecallerName();
    $legacyValue = implode('|', [$user->getAuthIdentifier(), $user->getRememberToken(), $user->getAuthPassword()]);

    $this->withCookie($cookie, $legacyValue)
        ->get(route('profile.edit'))
        ->assertRedirect(route('login'))
        ->assertCookieExpired($cookie);
});
