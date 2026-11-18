<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Laravel\Passkeys\Passkey;

class RenamePasskey
{
    /**
     * Rename one of the user's own passkeys.
     *
     * @throws AuthorizationException
     */
    public function handle(User $user, Passkey $passkey, string $name): Passkey
    {
        if (! $user->passkeys()->whereKey($passkey->getKey())->exists()) {
            throw new AuthorizationException;
        }

        $passkey->update(['name' => $name]);

        return $passkey;
    }
}
