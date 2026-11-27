<?php

namespace App\Support;

use App\Enums\Accent;
use App\Enums\ContrastPreference;
use App\Enums\Theme;
use App\Models\Organization;
use App\Models\User;

/**
 * The look a page renders with: the user's theme and contrast, and their own accent colour, else the
 * organization's, else violet. Guests get the defaults.
 */
class ThemePreferences
{
    /**
     * @return array{theme: string, accent: string, ownAccent: string|null, organizationAccent: string, contrast: string}
     */
    public static function for(?User $user, ?Organization $organization): array
    {
        $organizationAccent = $organization->accent ?? Accent::Violet;

        return [
            'theme' => ($user->theme ?? Theme::Standard)->value,
            'accent' => ($user->accent ?? $organizationAccent)->value,
            'ownAccent' => $user?->accent?->value,
            'organizationAccent' => $organizationAccent->value,
            'contrast' => ($user->contrast ?? ContrastPreference::System)->value,
        ];
    }
}
