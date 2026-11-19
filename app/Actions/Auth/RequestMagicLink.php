<?php

namespace App\Actions\Auth;

use App\Models\User;

class RequestMagicLink
{
    public function __construct(private readonly SendMagicLink $sendMagicLink)
    {
        //
    }

    /**
     * Email a sign-in link if an account exists for the address. The caller always shows the same
     * message, so the response does not reveal whether the account exists.
     */
    public function handle(string $email, ?string $redirectTo = null): void
    {
        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [mb_strtolower(trim($email))])
            ->first();

        if ($user) {
            $this->sendMagicLink->handle($user, $redirectTo);
        }
    }
}
