<?php

namespace App\Http\Requests\Organizations;

use App\Rules\OrganizationName;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class UpdateOrganizationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return Gate::allows('update', $this->route('organization'));
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', new OrganizationName],
            'currency' => ['required', 'string', 'regex:/^[A-Z]{3}$/'],
            // Stored in the minor currency unit (öre).
            'default_hourly_rate' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'week_starts_on' => ['required', 'integer', 'between:1,7'],
            'timezone' => ['required', 'string', 'timezone:all'],
            // Full absence days count as this many hours.
            'workday_hours' => ['sometimes', 'numeric', 'min:1', 'max:24'],
            // Whether members may start and stop a timer.
            'timer_enabled' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * The validated attributes for UpdateOrganization.
     *
     * @return array{name: string, currency: string, default_hourly_rate: int|null, week_starts_on: int, timezone: string, workday_seconds?: int, timer_enabled?: bool}
     */
    public function settings(): array
    {
        $settings = [
            'name' => $this->string('name')->trim()->value(),
            'currency' => $this->string('currency')->value(),
            'default_hourly_rate' => $this->filled('default_hourly_rate') ? $this->integer('default_hourly_rate') : null,
            'week_starts_on' => $this->integer('week_starts_on'),
            'timezone' => $this->string('timezone')->value(),
        ];

        if ($this->has('workday_hours')) {
            $settings['workday_seconds'] = (int) round($this->float('workday_hours') * 3600);
        }

        if ($this->has('timer_enabled')) {
            $settings['timer_enabled'] = $this->boolean('timer_enabled');
        }

        return $settings;
    }
}
