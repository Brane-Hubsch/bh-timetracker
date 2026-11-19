<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Auth\RevokeAiConnection;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Date;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Passport\Token;

/**
 * Settings → AI connections: how to connect an MCP client and which ones are connected.
 */
class AiConnectionController extends Controller
{
    public function edit(#[CurrentUser] User $user): Response
    {
        /** @var Collection<int, Token> $tokens */
        $tokens = $user->tokens()
            ->with('client')
            ->where('revoked', false)
            ->where('expires_at', '>', Date::now())
            ->get();

        return Inertia::render('settings/ai-connections', [
            'mcpUrl' => url('/mcp'),
            'connections' => $tokens
                ->filter(fn (Token $token) => $token->client !== null)
                ->groupBy('client_id')
                ->map(function (Collection $tokens) {
                    /** @var Token $first */
                    $first = $tokens->sortBy('created_at')->first();
                    /** @var Token $latest */
                    $latest = $tokens->sortByDesc('created_at')->first();

                    return [
                        'clientId' => (string) $first->client_id,
                        'name' => $first->client->name ?? '',
                        'connectedAt' => $first->created_at?->toIso8601String(),
                        'lastActiveAt' => $latest->created_at?->toIso8601String(),
                    ];
                })
                ->sortBy('name')
                ->values()
                ->all(),
        ]);
    }

    public function destroy(#[CurrentUser] User $user, string $client, RevokeAiConnection $revokeAiConnection): RedirectResponse
    {
        abort_if($revokeAiConnection->handle($user, $client) === 0, 404);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('The AI assistant was disconnected.')]);

        return back();
    }
}
