<?php

namespace App\Http\Requests\Organizations;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateMemberRateRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // Minor currency unit (öre).
            'hourly_rate' => ['nullable', 'integer', 'min:0', 'max:100000000'],
        ];
    }

    public function hourlyRate(): ?int
    {
        return $this->filled('hourly_rate') ? $this->integer('hourly_rate') : null;
    }
}
