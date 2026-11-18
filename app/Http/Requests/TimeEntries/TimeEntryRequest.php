<?php

namespace App\Http\Requests\TimeEntries;

use App\Data\TimeEntryData;
use App\Enums\TimeEntrySource;
use App\Models\User;
use App\Support\DurationParser;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Times are entered as a date, a start time and either an end time or a duration ("1,5", "1:30",
 * "90m") in the signed-in user's time zone. An end before the start means the next day.
 */
class TimeEntryRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'user_id' => ['nullable', 'integer'],
            'project_id' => ['required', 'integer'],
            'description' => ['nullable', 'string', 'max:5000'],
            'is_billable' => ['nullable', 'boolean'],
            'date' => ['required', 'date_format:Y-m-d'],
            'start' => ['required', 'date_format:H:i'],
            'end' => ['nullable', 'required_without:duration', 'date_format:H:i'],
            'duration' => ['nullable', 'required_without:end', 'string', 'max:32'],
        ];
    }

    /**
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->filled('end') || ! $this->filled('duration') || $validator->errors()->has('duration')) {
                    return;
                }

                $seconds = app(DurationParser::class)->parse($this->string('duration')->value());

                if ($seconds === null || $seconds <= 0) {
                    $validator->errors()->add('duration', __('Enter a duration such as 1,5, 1:30 or 90m.'));
                }
            },
        ];
    }

    public function timeEntryData(?User $defaultUser = null): TimeEntryData
    {
        $user = $this->user();
        $timezone = $user instanceof User ? $user->timezone : config()->string('app.timezone');
        $date = $this->string('date')->value();
        $startedAt = CarbonImmutable::parse($date.' '.$this->string('start')->value(), $timezone);

        if ($this->filled('end')) {
            $endedAt = CarbonImmutable::parse($date.' '.$this->string('end')->value(), $timezone);

            if ($endedAt->lessThanOrEqualTo($startedAt)) {
                $endedAt = $endedAt->addDay();
            }
        } else {
            $endedAt = $startedAt->addSeconds(app(DurationParser::class)->parse($this->string('duration')->value()) ?? 0);
        }

        return new TimeEntryData(
            userId: $this->filled('user_id') ? $this->integer('user_id') : (($defaultUser ?? $user)->id ?? 0),
            projectId: $this->integer('project_id'),
            startedAt: $startedAt->utc(),
            endedAt: $endedAt->utc(),
            description: $this->filled('description') ? $this->string('description')->value() : null,
            isBillable: $this->has('is_billable') && $this->input('is_billable') !== null ? $this->boolean('is_billable') : null,
            source: TimeEntrySource::Web,
        );
    }
}
