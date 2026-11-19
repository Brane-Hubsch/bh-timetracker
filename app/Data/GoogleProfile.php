<?php

namespace App\Data;

use Laravel\Socialite\Contracts\User as SocialiteUser;

/**
 * The parts of a Google account we use for signing in.
 */
readonly class GoogleProfile
{
    public function __construct(
        public string $id,
        public string $email,
        public string $name,
        public bool $emailVerified,
        public ?string $avatarUrl = null,
    ) {
        //
    }

    public static function fromSocialite(SocialiteUser $user): self
    {
        /** @var array<string, mixed> $raw */
        $raw = method_exists($user, 'getRaw') ? $user->getRaw() : [];
        $verified = $raw['email_verified'] ?? $raw['verified_email'] ?? false;

        return new self(
            id: (string) $user->getId(),
            email: mb_strtolower((string) $user->getEmail()),
            name: (string) ($user->getName() ?: $user->getEmail()),
            emailVerified: $verified === true || $verified === 'true',
            avatarUrl: $user->getAvatar(),
        );
    }
}
