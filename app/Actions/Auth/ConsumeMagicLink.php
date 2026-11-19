<?php

namespace App\Actions\Auth;

use App\Models\MagicLink;
use Illuminate\Support\Facades\DB;

class ConsumeMagicLink
{
    /**
     * Use a magic link: mark it as used and, since the user proved access to the inbox, mark the
     * email address as verified. Returns null for unknown, used or expired links.
     */
    public function handle(string $token): ?MagicLink
    {
        return DB::transaction(function () use ($token) {
            $link = MagicLink::findUsable($token);

            if (! $link) {
                return null;
            }

            // Guard against double use in concurrent requests.
            $claimed = MagicLink::query()
                ->whereKey($link->id)
                ->whereNull('used_at')
                ->update(['used_at' => now()]);

            if ($claimed === 0) {
                return null;
            }

            $user = $link->user;

            if (! $user->hasVerifiedEmail()) {
                $user->markEmailAsVerified();
            }

            return $link->refresh();
        });
    }
}
