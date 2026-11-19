<?php

namespace App\Actions\Auth;

use App\Models\User;
use Laravel\Passport\Token;

/**
 * Disconnect an AI assistant (MCP client): revoke all of the user's access and refresh tokens for
 * that OAuth client. The assistant has to ask for approval again to reconnect.
 */
class RevokeAiConnection
{
    /**
     * @return int the number of revoked access tokens
     */
    public function handle(User $user, string $clientId): int
    {
        $tokens = $user->tokens()->where('client_id', $clientId)->where('revoked', false)->get();

        $tokens->each(function (Token $token): void {
            $token->revoke();
            $token->refreshToken?->revoke();
        });

        return $tokens->count();
    }
}
