<?php

namespace App\Http\Requests\Settings;

use App\Enums\Accent;
use App\Enums\ContrastPreference;
use App\Enums\Theme;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AppearanceUpdateRequest extends FormRequest
{
    /**
     * @return array<string, array<mixed>>
     */
    public function rules(): array
    {
        return [
            'theme' => ['sometimes', 'required', Rule::enum(Theme::class)],
            // Null follows the organization's colour.
            'accent' => ['sometimes', 'nullable', 'string', Rule::anyOf([
                [Rule::enum(Accent::class)],
                ['regex:/\A#[0-9a-f]{6}\z/i'],
            ])],
            'contrast' => ['sometimes', 'required', Rule::enum(ContrastPreference::class)],
        ];
    }

    /**
     * The sent preferences for UpdateAppearance.
     *
     * @return array{theme?: Theme, accent?: Accent|string|null, contrast?: ContrastPreference}
     */
    public function preferences(): array
    {
        $preferences = [];

        if ($this->has('theme')) {
            $preferences['theme'] = $this->enum('theme', Theme::class) ?? Theme::Standard;
        }

        if ($this->has('accent')) {
            $accent = $this->validated('accent');
            $preferences['accent'] = is_string($accent) ? (Accent::tryFrom($accent) ?? strtolower($accent)) : null;
        }

        if ($this->has('contrast')) {
            $preferences['contrast'] = $this->enum('contrast', ContrastPreference::class) ?? ContrastPreference::System;
        }

        return $preferences;
    }
}
