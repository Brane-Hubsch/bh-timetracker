<?php

namespace App\Support;

/**
 * Which sign-in and registration methods are available (see config/auth.php).
 */
class SignInOptions
{
    /**
     * Password login is a development/test convenience and never available in production.
     */
    public function passwordLogin(): bool
    {
        return config()->boolean('auth.password_login') && ! app()->isProduction();
    }

    /**
     * Whether anyone may create an account without an invitation.
     */
    public function openRegistration(): bool
    {
        return config()->boolean('auth.open_registration');
    }

    /**
     * Whether Google sign-in is configured.
     */
    public function google(): bool
    {
        return filled(config('services.google.client_id')) && filled(config('services.google.client_secret'));
    }

    /**
     * Magic link lifetime in minutes.
     */
    public function magicLinkLifetime(): int
    {
        return config()->integer('auth.magic_link_lifetime');
    }

    /**
     * @return array{passwordLogin: bool, openRegistration: bool, google: bool}
     */
    public function toArray(): array
    {
        return [
            'passwordLogin' => $this->passwordLogin(),
            'openRegistration' => $this->openRegistration(),
            'google' => $this->google(),
        ];
    }
}
