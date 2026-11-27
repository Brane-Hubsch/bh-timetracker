<?php

namespace App\Http\Requests\TimeEntries;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

class TimeEntryScheduleRequest extends FormRequest
{
    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'start' => ['required', 'date_format:Y-m-d\TH:i'],
            'end' => ['required', 'date_format:Y-m-d\TH:i'],
        ];
    }

    /** @return array{CarbonImmutable, CarbonImmutable} */
    public function times(string $timezone): array
    {
        return [
            CarbonImmutable::parse($this->string('start')->value(), $timezone)->utc(),
            CarbonImmutable::parse($this->string('end')->value(), $timezone)->utc(),
        ];
    }
}
