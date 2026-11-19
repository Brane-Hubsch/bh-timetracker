<?php

namespace App\Http\Requests\Projects;

use App\Enums\ProjectVisibility;
use App\Models\Project;
use App\Support\CurrentOrganization;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProjectRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $organizationId = app(CurrentOrganization::class)->id();
        $project = $this->route('project');

        return [
            'name' => ['required', 'string', 'max:255'],
            'client_id' => ['nullable', 'integer', Rule::exists('clients', 'id')->where('organization_id', $organizationId)],
            'code' => [
                'nullable', 'string', 'max:32',
                Rule::unique('projects', 'code')
                    ->where('organization_id', $organizationId)
                    ->ignore($project instanceof Project ? $project->id : null),
            ],
            'color' => ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'is_billable' => ['required', 'boolean'],
            // Minor currency unit (öre); the form converts from kronor.
            'hourly_rate' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'estimate_hours' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'visibility' => ['required', Rule::enum(ProjectVisibility::class)],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            'notes' => ['nullable', 'string', 'max:10000'],
        ];
    }

    /**
     * @return array{name: string, client_id: int|null, code: string|null, color: string, is_billable: bool, hourly_rate: int|null, estimate_seconds: int|null, visibility: string, starts_on: string|null, ends_on: string|null, notes: string|null}
     */
    public function projectAttributes(): array
    {
        return [
            'name' => $this->string('name')->trim()->value(),
            'client_id' => $this->filled('client_id') ? $this->integer('client_id') : null,
            'code' => $this->filled('code') ? $this->string('code')->trim()->value() : null,
            'color' => $this->string('color')->lower()->value(),
            'is_billable' => $this->boolean('is_billable'),
            'hourly_rate' => $this->filled('hourly_rate') ? $this->integer('hourly_rate') : null,
            'estimate_seconds' => $this->filled('estimate_hours') ? (int) round($this->float('estimate_hours') * 3600) : null,
            'visibility' => $this->string('visibility')->value(),
            'starts_on' => $this->filled('starts_on') ? $this->string('starts_on')->value() : null,
            'ends_on' => $this->filled('ends_on') ? $this->string('ends_on')->value() : null,
            'notes' => $this->filled('notes') ? $this->string('notes')->trim()->value() : null,
        ];
    }
}
