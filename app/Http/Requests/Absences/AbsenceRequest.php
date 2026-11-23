<?php

namespace App\Http\Requests\Absences;

use App\Data\AbsenceData;
use App\Enums\AbsenceType;
use App\Models\Absence;
use App\Models\User;
use App\Support\DurationParser;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * An absence as entered: kind, first and last day, and optionally the hours per day ("4", "4,5",
 * "4:30"); without hours it is full working days.
 */
class AbsenceRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'user_id' => ['nullable', 'integer'],
            'type' => ['required', Rule::enum(AbsenceType::class)],
            'starts_on' => ['required', 'date_format:Y-m-d'],
            'ends_on' => ['required', 'date_format:Y-m-d'],
            'hours_per_day' => ['nullable', 'string', 'max:16'],
            'note' => ['nullable', 'string', 'max:'.Absence::MAX_NOTE_LENGTH],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($this->filled('hours_per_day') && $this->secondsPerDay() === null) {
                    $validator->errors()->add('hours_per_day', __('Enter the hours per day, at most 24.'));
                }
            },
        ];
    }

    public function absenceData(User $defaultUser): AbsenceData
    {
        return new AbsenceData(
            userId: $this->filled('user_id') ? $this->integer('user_id') : $defaultUser->id,
            type: AbsenceType::from($this->string('type')->value()),
            startsOn: CarbonImmutable::parse($this->string('starts_on')->value()),
            endsOn: CarbonImmutable::parse($this->string('ends_on')->value()),
            secondsPerDay: $this->secondsPerDay(),
            note: $this->filled('note') ? $this->string('note')->value() : null,
        );
    }

    private function secondsPerDay(): ?int
    {
        if (! $this->filled('hours_per_day')) {
            return null;
        }

        $seconds = app(DurationParser::class)->parse($this->string('hours_per_day')->value());

        return $seconds !== null && $seconds > 0 && $seconds <= 86400 ? $seconds : null;
    }
}
