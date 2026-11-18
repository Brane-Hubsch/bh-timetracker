<?php

namespace App\Http\Requests\Auth;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class MagicLinkRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'redirect_to' => ['nullable', 'string', 'max:2048'],
        ];
    }

    public function email(): string
    {
        return $this->string('email')->trim()->value();
    }

    public function redirectTo(): ?string
    {
        return $this->filled('redirect_to') ? $this->string('redirect_to')->value() : null;
    }
}
