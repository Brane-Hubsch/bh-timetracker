<?php

namespace App\Http\Requests\Projects;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class AssignProjectMemberRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'user_id' => [$this->route('user') ? 'prohibited' : 'required', 'integer', 'exists:users,id'],
            // Minor currency unit (öre).
            'hourly_rate' => ['nullable', 'integer', 'min:0', 'max:100000000'],
        ];
    }

    public function hourlyRate(): ?int
    {
        return $this->filled('hourly_rate') ? $this->integer('hourly_rate') : null;
    }

    public function userId(): int
    {
        return $this->integer('user_id');
    }
}
