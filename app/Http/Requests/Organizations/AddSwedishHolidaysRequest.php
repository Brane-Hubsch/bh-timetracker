<?php

namespace App\Http\Requests\Organizations;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class AddSwedishHolidaysRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $year = (int) now()->format('Y');

        return [
            'year' => ['required', 'integer', 'min:'.($year - 1), 'max:'.($year + 5)],
        ];
    }

    public function year(): int
    {
        return $this->integer('year');
    }
}
