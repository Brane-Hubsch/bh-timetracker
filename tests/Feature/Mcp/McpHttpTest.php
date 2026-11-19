<?php

use App\Models\User;
use Illuminate\Support\Facades\Log;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Passport\Client;
use Laravel\Passport\Passport;

function jsonRpc(string $method, array $params = []): array
{
    return ['jsonrpc' => '2.0', 'id' => 1, 'method' => $method, 'params' => $params];
}

it('requires an OAuth token', function () {
    $this->postJson('/mcp', jsonRpc('tools/list'))->assertUnauthorized();
});

it('lists the tools for an authenticated user and logs the call', function () {
    $user = User::factory()->create();
    Passport::actingAs($user, ['mcp:use']);
    Log::shouldReceive('info')->once()->with('mcp.request', Mockery::on(fn (array $context) => $context['method'] === 'tools/list' && $context['user_id'] === $user->id));

    $response = $this->postJson('/mcp', jsonRpc('tools/list'))->assertOk();

    // Every tool on one page, without a pagination cursor.
    expect(collect($response->json('result.tools'))->pluck('name')->sort()->values()->all())->toBe([
        'archive_client', 'archive_project', 'cancel_invitation', 'create_client', 'create_project',
        'create_time_entries', 'delete_tag', 'delete_time_entry', 'export_report', 'get_context',
        'get_project_status', 'get_report', 'invite_member', 'list_clients', 'list_members', 'list_projects',
        'list_time_entries', 'remove_member', 'rename_tag', 'update_client', 'update_member', 'update_project',
        'update_time_entry',
    ])->and($response->json('result.nextCursor'))->toBeNull();

    $tools = collect($response->json('result.tools'))->keyBy('name');

    expect($tools['list_projects']['annotations']['readOnlyHint'] ?? null)->toBeTrue()
        ->and($tools['delete_time_entry']['annotations']['destructiveHint'] ?? null)->toBeTrue();
});

it('runs tools as the authenticated user', function () {
    $user = User::factory()->create(['name' => 'Mia Member']);
    Passport::actingAs($user, ['mcp:use']);

    $this->postJson('/mcp', jsonRpc('tools/call', ['name' => 'get_context', 'arguments' => []]))
        ->assertOk()
        ->assertJsonPath('result.structuredContent.user.name', 'Mia Member')
        ->assertJsonPath('result.structuredContent.organization.slug', $user->currentOrganization->slug);
});

it('publishes OAuth discovery metadata', function () {
    $this->getJson('/.well-known/oauth-authorization-server')
        ->assertOk()
        ->assertJsonPath('authorization_endpoint', route('passport.authorizations.authorize'))
        ->assertJsonPath('code_challenge_methods_supported', ['S256']);

    $this->getJson('/.well-known/oauth-protected-resource/mcp')
        ->assertOk()
        ->assertJsonPath('resource', url('/mcp'));
});

/**
 * An authorization request from a public (PKCE) client, as Claude sends it.
 */
function authorizationUrl(): string
{
    $client = Client::factory()->asPublic()->create([
        'name' => 'Claude',
        'redirect_uris' => ['https://claude.ai/api/mcp/auth_callback'],
        'grant_types' => ['authorization_code', 'refresh_token'],
    ]);

    return route('passport.authorizations.authorize', [
        'client_id' => $client->getKey(),
        'redirect_uri' => 'https://claude.ai/api/mcp/auth_callback',
        'response_type' => 'code',
        'scope' => 'mcp:use',
        'state' => 'xyz',
        'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', str_repeat('a', 64), true)), '+/', '-_'), '='),
        'code_challenge_method' => 'S256',
    ]);
}

it('asks the signed-in user to approve an AI client', function () {
    $this->actingAs(User::factory()->create())
        ->get(authorizationUrl())
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/oauth-authorize')
            ->where('client.name', 'Claude')
            ->where('redirectHost', 'claude.ai')
            ->where('state', 'xyz')
            ->where('action', route('passport.authorizations.approve')));
});

it('sends guests to sign in before approving', function () {
    $this->get(authorizationUrl())->assertRedirect(route('login'));
});

it('loads the approval page as a full page after an Inertia sign-in', function () {
    $this->actingAs(User::factory()->create())
        ->get(authorizationUrl(), ['X-Inertia' => 'true'])
        ->assertStatus(409)
        ->assertHeader('X-Inertia-Location');
});
