<?php

namespace App\Actions\Auth;

use App\Models\MagicLink;
use App\Models\User;
use App\Notifications\Auth\MagicLinkNotification;
use App\Support\SignInOptions;
use Illuminate\Support\Str;

class SendMagicLink
{
    public function __construct(private readonly SignInOptions $options)
    {
        //
    }

    /**
     * Issue a single-use sign-in link for the user and email it.
     *
     * @param  string|null  $redirectTo  Relative path to continue to after signing in.
     */
    public function handle(User $user, ?string $redirectTo = null): MagicLink
    {
        $token = Str::random(64);
        $lifetime = $this->options->magicLinkLifetime();

        $link = $user->magicLinks()->create([
            'token_hash' => MagicLink::hashToken($token),
            'redirect_to' => $this->sanitizeRedirect($redirectTo),
            'expires_at' => now()->addMinutes($lifetime),
        ]);

        $user->notify(new MagicLinkNotification(route('magic-link.show', $token), $lifetime));

        return $link;
    }

    /**
     * Only allow relative paths on this site (no open redirects).
     */
    private function sanitizeRedirect(?string $redirectTo): ?string
    {
        if ($redirectTo === null || ! str_starts_with($redirectTo, '/') || str_starts_with($redirectTo, '//')) {
            return null;
        }

        return $redirectTo;
    }
}
