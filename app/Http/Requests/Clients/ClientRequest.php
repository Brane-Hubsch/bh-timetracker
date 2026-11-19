<?php

namespace App\Http\Requests\Clients;

use App\Http\Requests\Images\ImageUploadRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

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
            'logo' => ['nullable', ...ImageUploadRequest::imageRules()],
            'remove_logo' => ['nullable', 'boolean'],
        ];
    }

    /**
     * A new logo to store, if one was uploaded.
     */
    public function logo(): ?UploadedFile
    {
        $file = $this->file('logo');

        return $file instanceof UploadedFile ? $file : null;
    }

    /**
     * Whether the current logo should be removed (and no new one was uploaded).
     */
    public function removesLogo(): bool
    {
        return $this->logo() === null && $this->boolean('remove_logo');
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
