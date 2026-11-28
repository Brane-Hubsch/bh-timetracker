<?php

namespace App\Actions\Settings;

use App\Enums\Accent;
use App\Enums\ContrastPreference;
use App\Enums\Theme;
use App\Models\User;

class UpdateAppearance
{
    /**
     * Save the user's theme, accent colour and contrast. Only the given keys change; a null accent
     * follows the organization's colour again.
     *
     * @param  array{theme?: Theme, accent?: Accent|string|null, contrast?: ContrastPreference}  $preferences
     */
    public function handle(User $user, array $preferences): void
    {
        if (array_key_exists('theme', $preferences)) {
            $user->theme = $preferences['theme'];
        }

        if (array_key_exists('accent', $preferences)) {
            $user->accent = $preferences['accent'];
        }

        if (array_key_exists('contrast', $preferences)) {
            $user->contrast = $preferences['contrast'];
        }

        $user->save();
    }
}
