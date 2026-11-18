<?php

namespace App\Http\Requests\Clients;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ClientRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'organization_number' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * @return array{name: string, organization_number: string|null, email: string|null, notes: string|null}
     */
    public function clientAttributes(): array
    {
        return [
            'name' => $this->string('name')->trim()->value(),
            'organization_number' => $this->nullableString('organization_number'),
            'email' => $this->nullableString('email'),
            'notes' => $this->nullableString('notes'),
        ];
    }

    private function nullableString(string $key): ?string
    {
        $value = $this->string($key)->trim()->value();

        return $value === '' ? null : $value;
    }
}
