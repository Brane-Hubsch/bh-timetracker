<?php

namespace App\Support;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Uploaded import files between the preview and the import, kept in the cache (shared by all app
 * servers) for a couple of hours and only readable by the user who uploaded them, in their
 * organization.
 */
class PendingImports
{
    private const int TTL_SECONDS = 2 * 60 * 60;

    public function put(Organization $organization, User $user, string $contents): string
    {
        $token = (string) Str::uuid();
        Cache::put($this->key($organization, $user, $token), $contents, self::TTL_SECONDS);

        return $token;
    }

    public function get(Organization $organization, User $user, string $token): ?string
    {
        $contents = Cache::get($this->key($organization, $user, $token));

        return is_string($contents) ? $contents : null;
    }

    public function forget(Organization $organization, User $user, string $token): void
    {
        Cache::forget($this->key($organization, $user, $token));
    }

    private function key(Organization $organization, User $user, string $token): string
    {
        return "imports:{$organization->id}:{$user->id}:{$token}";
    }
}
