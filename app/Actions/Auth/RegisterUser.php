<?php

namespace App\Actions\Auth;

use App\Models\User;

class RegisterUser
{
    public function __construct(private readonly SendMagicLink $sendMagicLink)
    {
        //
    }

    /**
     * Self-registration (only when open registration is enabled): create a passwordless, unverified
     * account and email a magic link that verifies the address and signs in. An existing address
     * just gets a sign-in link, so registration never reveals or takes over accounts.
     */
    public function handle(string $name, string $email): void
    {
        $email = mb_strtolower(trim($email));

        $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first()
            ?? User::create([
                'name' => trim($name),
                'email' => $email,
            ]);

        $this->sendMagicLink->handle($user);
    }
}
