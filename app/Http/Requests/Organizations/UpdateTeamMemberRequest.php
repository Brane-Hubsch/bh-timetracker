<?php

namespace App\Http\Requests\Organizations;

use App\Enums\OrganizationRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTeamMemberRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'role' => ['sometimes', 'required', Rule::enum(OrganizationRole::class)->except(OrganizationRole::Owner)],
            'hourly_rate' => ['sometimes', 'nullable', 'integer', 'between:0,100000000'],
            'week_starts_on' => ['present', 'nullable', 'integer', 'between:1,7'],
            'working_days' => ['present', 'list', 'max:7'],
            'working_days.*' => ['integer', 'between:1,7', 'distinct'],
            'workday_hours' => ['present', 'nullable', 'numeric', 'between:0,24'],
        ];
    }

    /** @return array{week_starts_on: ?int, working_days: list<int>, workday_seconds: ?int} */
    public function schedule(): array
    {
        return [
            'week_starts_on' => $this->filled('week_starts_on') ? $this->integer('week_starts_on') : null,
            'working_days' => array_values(array_map(intval(...), $this->array('working_days'))),
            'workday_seconds' => $this->filled('workday_hours') ? (int) round($this->float('workday_hours') * 3600) : null,
        ];
    }

    public function role(): ?OrganizationRole
    {
        return $this->has('role') ? OrganizationRole::from($this->string('role')->value()) : null;
    }

    public function hourlyRate(): ?int
    {
        return $this->filled('hourly_rate') ? $this->integer('hourly_rate') : null;
    }
}
