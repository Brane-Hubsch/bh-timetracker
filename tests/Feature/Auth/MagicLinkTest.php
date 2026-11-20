<?php

use App\Actions\Auth\SendMagicLink;
use App\Models\MagicLink;
use App\Models\User;
use App\Notifications\Auth\MagicLinkNotification;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

function issueLink(User $user, ?string $redirectTo = null): string
{
    $token = null;
    Notification::fake();

    app(SendMagicLink::class)->handle($user, $redirectTo);

    Notification::assertSentTo($user, MagicLinkNotification::class, function (MagicLinkNotification $notification) use (&$token) {
        $token = basename(parse_url($notification->url, PHP_URL_PATH) ?: '');

        return true;
    });

    return $token;
}

it('emails a sign-in link to existing accounts', function () {
    Notification::fake();
    $user = User::factory()->passwordless()->create(['email' => 'anna@example.com']);

    $this->post(route('magic-link.store'), ['email' => 'Anna@Example.com'])
        ->assertSessionHas('status');

    Notification::assertSentTo($user, MagicLinkNotification::class);
    expect(MagicLink::where('user_id', $user->id)->count())->toBe(1);
});

it('answers the same way for unknown addresses without sending anything', function () {
    Notification::fake();

    $this->post(route('magic-link.store'), ['email' => 'nobody@example.com'])
        ->assertSessionHas('status', __('If an account exists for that address, we have emailed a sign-in link.'));

    Notification::assertNothingSent();
    expect(MagicLink::count())->toBe(0);
});

it('only stores a hash of the token', function () {
    $user = User::factory()->create();
    $token = issueLink($user);

    expect(MagicLink::where('token_hash', $token)->exists())->toBeFalse()
        ->and(MagicLink::where('token_hash', MagicLink::hashToken($token))->exists())->toBeTrue();
});

it('does not use the link when it is opened', function () {
    $user = User::factory()->create();
    $token = issueLink($user);

    $this->get(route('magic-link.show', $token))
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/magic-link')
            ->where('isValid', true)
            ->where('email', $user->email));

    $this->assertGuest();
    expect(MagicLink::findUsable($token))->not->toBeNull();
});

it('signs in, verifies the email and confirms access when used', function () {
    $user = User::factory()->passwordless()->unverified()->create();
    $token = issueLink($user);

    $response = $this->post(route('magic-link.consume', $token));

    $this->assertAuthenticatedAs($user);
    expect($user->fresh()->hasVerifiedEmail())->toBeTrue()
        ->and(session('auth.password_confirmed_at'))->not->toBeNull();
    $response->assertRedirect(route('passkey-setup'));
});

it('sends users with a passkey straight to their organization', function () {
    $user = User::factory()->create();
    $user->passkeys()->create(['name' => 'Mac', 'credential_id' => 'abc', 'credential' => ['x' => 1]]);
    $token = issueLink($user);

    $this->post(route('magic-link.consume', $token))
        ->assertRedirect(route('time.index', ['current_organization' => $user->currentOrganization->slug]));
});

it('continues to a safe relative redirect', function () {
    $user = User::factory()->create();
    $token = issueLink($user, '/settings/security');

    $this->post(route('magic-link.consume', $token))->assertRedirect('/settings/security');
});

it('ignores redirects to other sites', function (string $redirect) {
    $user = User::factory()->create();
    $token = issueLink($user, $redirect);

    expect(MagicLink::first()->redirect_to)->toBeNull();
    $this->post(route('magic-link.consume', $token))->assertRedirect(route('passkey-setup'));
})->with(['https://evil.example.com', '//evil.example.com/path', 'javascript:alert(1)']);

it('works only once', function () {
    $user = User::factory()->create();
    $token = issueLink($user);

    $this->post(route('magic-link.consume', $token));
    auth()->logout();

    $this->post(route('magic-link.consume', $token))->assertRedirect(route('login'));
    $this->assertGuest();
});

it('expires', function () {
    $user = User::factory()->create();
    $token = issueLink($user);

    $this->travel(config('auth.magic_link_lifetime') + 1)->minutes();

    $this->get(route('magic-link.show', $token))
        ->assertInertia(fn (Assert $page) => $page->where('isValid', false));
    $this->post(route('magic-link.consume', $token))->assertRedirect(route('login'));
    $this->assertGuest();
});

it('rejects unknown tokens', function () {
    $this->post(route('magic-link.consume', 'not-a-real-token'))->assertRedirect(route('login'));
    $this->assertGuest();
});

it('throttles link requests per address', function () {
    Notification::fake();
    User::factory()->create(['email' => 'anna@example.com']);

    foreach (range(1, 3) as $attempt) {
        $this->post(route('magic-link.store'), ['email' => 'anna@example.com']);
    }

    $this->post(route('magic-link.store'), ['email' => 'anna@example.com'])->assertTooManyRequests();
});

it('emails signed-in users a confirmation link that continues to the intended page', function () {
    Notification::fake();
    $user = User::factory()->passwordless()->create();

    $this->actingAs($user)
        ->withSession(['url.intended' => url('/settings/security')])
        ->post(route('magic-link.confirm'))
        ->assertSessionHas('status');

    expect(MagicLink::where('user_id', $user->id)->first()->redirect_to)->toBe('/settings/security');
    Notification::assertSentTo($user, MagicLinkNotification::class);
});

it('prunes old links', function () {
    $user = User::factory()->create();
    issueLink($user);
    $this->travel(2)->days();

    $this->artisan('model:prune', ['--model' => [MagicLink::class]]);

    expect(MagicLink::count())->toBe(0);
});
