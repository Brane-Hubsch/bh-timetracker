<?php

use App\Models\User;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Passport\Client;
use Laravel\Passport\Passport;
use Laravel\Passport\RefreshToken;
use Laravel\Passport\Token;

function issueToken(User $user, Client $client, array $attributes = []): Token
{
    $token = Passport::token()->forceCreate([
        'id' => Str::random(80),
        'user_id' => $user->id,
        'client_id' => $client->getKey(),
        'scopes' => ['mcp:use'],
        'revoked' => false,
        'expires_at' => now()->addDay(),
        ...$attributes,
    ]);

    Passport::refreshToken()->forceCreate([
        'id' => Str::random(80),
        'access_token_id' => $token->getKey(),
        'revoked' => false,
        'expires_at' => now()->addDays(60),
    ]);

    return $token;
}

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->claude = Client::factory()->asPublic()->create(['name' => 'Claude']);
});

it('shows the MCP address and connected assistants', function () {
    issueToken($this->user, $this->claude, ['created_at' => now()->subDays(3)]);
    issueToken($this->user, $this->claude);
    issueToken($this->user, Client::factory()->asPublic()->create(['name' => 'Gammal']), ['revoked' => true]);
    issueToken(User::factory()->create(), Client::factory()->asPublic()->create(['name' => 'Någon annans']));

    $this->actingAs($this->user)
        ->get(route('ai-connections.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/ai-connections')
            ->where('mcpUrl', url('/mcp'))
            ->has('connections', 1)
            ->where('connections.0.name', 'Claude')
            ->where('connections.0.clientId', $this->claude->getKey()));
});

it('disconnects an assistant by revoking its tokens', function () {
    $token = issueToken($this->user, $this->claude);

    $this->actingAs($this->user)
        ->delete(route('ai-connections.destroy', ['client' => $this->claude->getKey()]))
        ->assertRedirect();

    expect($token->fresh()->revoked)->toBeTrue()
        ->and(RefreshToken::query()->where('access_token_id', $token->getKey())->value('revoked'))->toBeTruthy();
});

it('cannot disconnect another user\'s assistant', function () {
    $token = issueToken(User::factory()->create(), $this->claude);

    $this->actingAs($this->user)
        ->delete(route('ai-connections.destroy', ['client' => $this->claude->getKey()]))
        ->assertNotFound();

    expect($token->fresh()->revoked)->toBeFalse();
});
