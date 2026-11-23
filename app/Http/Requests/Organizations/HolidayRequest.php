<?php

namespace App\Http\Requests\Organizations;

use App\Models\Holiday;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class HolidayRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'date' => ['required', 'date_format:Y-m-d'],
            'name' => ['required', 'string', 'max:'.Holiday::MAX_NAME_LENGTH],
        ];
    }

    public function holidayDate(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('!Y-m-d', $this->string('date')->value()) ?: CarbonImmutable::today();
    }

    public function holidayName(): string
    {
        return $this->string('name')->trim()->value();
    }
}
