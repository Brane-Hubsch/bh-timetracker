<?php

namespace App\Http\Requests\Timers;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Stopping the timer: optionally with its latest details (from the timer dialog) and an end time
 * (local date and time, default: now). Without details the timer is stopped as it is.
 */
class StopTimerRequest extends TimerRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'end_date' => ['nullable', 'required_with:end', 'date_format:Y-m-d'],
            'end' => ['nullable', 'required_with:end_date', 'date_format:H:i'],
        ];
    }

    /**
     * Whether the request carries the timer's details, to save before stopping.
     */
    public function hasDetails(): bool
    {
        return $this->has('project_id');
    }

    public function endedAt(): ?CarbonImmutable
    {
        return $this->localTime('end_date', 'end');
    }
}
