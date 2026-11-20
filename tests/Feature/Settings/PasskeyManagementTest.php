<?php

use App\Actions\Auth\RenamePasskey;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Inertia\Testing\AssertableInertia as Assert;

function passkeyFor(User $user, string $name = 'MacBook')
{
    return $user->passkeys()->create([
        'name' => $name,
        'credential_id' => fake()->uuid(),
        'credential' => ['x' => 1],
    ]);
}

it('requires a recent confirmation to show the security page', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('security.edit'))->assertRedirect(route('password.confirm'));
});

it('lists the user\'s own passkeys only', function () {
    $user = User::factory()->create();
    passkeyFor($user, 'Mine');
    passkeyFor(User::factory()->create(), 'Not mine');

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security')
            ->has('passkeys', 1)
            ->where('passkeys.0.name', 'Mine'));
});

it('renames a passkey', function () {
    $user = User::factory()->create();
    $passkey = passkeyFor($user);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->patch(route('passkeys.rename', $passkey), ['name' => 'Jobbdator'])
        ->assertRedirect();

    expect($passkey->fresh()->name)->toBe('Jobbdator');
});

it('cannot rename someone else\'s passkey', function () {
    $user = User::factory()->create();
    $passkey = passkeyFor(User::factory()->create());

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->patch(route('passkeys.rename', $passkey), ['name' => 'Hijacked'])
        ->assertForbidden();

    expect($passkey->fresh()->name)->toBe('MacBook');
});

it('refuses to rename other users\' passkeys in the action', function () {
    app(RenamePasskey::class)->handle(User::factory()->create(), passkeyFor(User::factory()->create()), 'x');
})->throws(AuthorizationException::class);

it('requires a confirmation to rename', function () {
    $user = User::factory()->create();
    $passkey = passkeyFor($user);

    $this->actingAs($user)
        ->patch(route('passkeys.rename', $passkey), ['name' => 'X'])
        ->assertRedirect(route('password.confirm'));
});

it('validates the name', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->patch(route('passkeys.rename', passkeyFor($user)), ['name' => ''])
        ->assertSessionHasErrors('name');
});

it('offers the access confirmation methods the user has', function () {
    $user = User::factory()->passwordless()->create();

    $this->actingAs($user)
        ->get(route('password.confirm'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/confirm-access')
            ->where('hasPasskeys', false)
            ->where('passwordLogin', true));
});

it('shows the passkey setup page after sign-up', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('passkey-setup'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/passkey-setup')
            ->where('continueTo', '/'.$user->currentOrganization->slug.'/time'));
});
