<?php

namespace App\Http\Requests\Timers;

use App\Data\TimerData;
use App\Models\Tag;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A timer as the time entry form sends it: project (optional until stopping), description, tags,
 * billable, and the local date and start time in the user's time zone (default: now).
 */
class TimerRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'project_id' => ['nullable', 'integer'],
            'description' => ['nullable', 'string', 'max:5000'],
            'is_billable' => ['nullable', 'boolean'],
            'tags' => ['nullable', 'array', 'max:'.Tag::MAX_PER_ENTRY],
            'tags.*' => ['string', 'max:'.Tag::MAX_NAME_LENGTH],
            'date' => ['nullable', 'required_with:start', 'date_format:Y-m-d'],
            'start' => ['nullable', 'required_with:date', 'date_format:H:i'],
        ];
    }

    public function timerData(): TimerData
    {
        $tags = $this->input('tags');

        return new TimerData(
            projectId: $this->filled('project_id') ? $this->integer('project_id') : null,
            startedAt: $this->localTime('date', 'start') ?? CarbonImmutable::now(),
            description: $this->filled('description') ? $this->string('description')->value() : null,
            isBillable: $this->input('is_billable') === null ? null : $this->boolean('is_billable'),
            tags: is_array($tags) ? array_values(array_filter($tags, 'is_string')) : [],
        );
    }

    /**
     * A local date and time in the user's time zone, as UTC; null when not given.
     */
    protected function localTime(string $dateKey, string $timeKey): ?CarbonImmutable
    {
        if (! $this->filled($dateKey) || ! $this->filled($timeKey)) {
            return null;
        }

        $user = $this->user();
        $timezone = $user instanceof User ? $user->timezone : config()->string('app.timezone');

        return CarbonImmutable::parse($this->string($dateKey)->value().' '.$this->string($timeKey)->value(), $timezone)->utc();
    }
}
