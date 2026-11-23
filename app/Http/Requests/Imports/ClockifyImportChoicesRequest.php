<?php

namespace App\Http\Requests\Imports;

use App\Services\Imports\ClockifyImportPlan;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The choices made in the import preview: which member each Clockify user's time goes to (or
 * "skip"), whether new projects are billable, the hourly rate per member and project, whether rows
 * that were already imported are updated and which project rows without one go to. Sent as lists,
 * since emails and project keys contain characters that don't work as input names.
 */
class ClockifyImportChoicesRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'members' => ['nullable', 'array', 'max:500'],
            'members.*.email' => ['required', 'string', 'max:255'],
            'members.*.member' => ['nullable', 'string', 'max:20'],
            'projects' => ['nullable', 'array', 'max:2000'],
            'projects.*.key' => ['required', 'string', 'max:600'],
            'projects.*.billable' => ['required', 'boolean'],
            'rates' => ['nullable', 'array', 'max:5000'],
            'rates.*.project' => ['required', 'string', 'max:600'],
            'rates.*.member' => ['required', 'integer'],
            'rates.*.rate' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'update_existing' => ['nullable', 'boolean'],
            'project_for_rows_without_project' => ['nullable', 'integer'],
        ];
    }

    /**
     * Email => member id, or null to skip that user. Users not listed match on email. A negative id
     * is a pending invitation (ClockifyImportPlan::invitationMemberId()).
     *
     * @return array<string, int|null>
     */
    public function memberMap(): array
    {
        $map = [];

        foreach ((array) $this->input('members', []) as $choice) {
            if (! is_array($choice) || ! is_string($choice['email'] ?? null)) {
                continue;
            }

            $member = $choice['member'] ?? null;
            $map[mb_strtolower($choice['email'])] = is_string($member) && preg_match('/^-?\d+$/', $member) === 1 ? (int) $member : null;
        }

        return $map;
    }

    /**
     * Project key => billable, for projects the import creates.
     *
     * @return array<string, bool>
     */
    public function billableByProject(): array
    {
        $billable = [];

        foreach ((array) $this->input('projects', []) as $choice) {
            if (is_array($choice) && is_string($choice['key'] ?? null)) {
                $billable[$choice['key']] = filter_var($choice['billable'] ?? true, FILTER_VALIDATE_BOOL);
            }
        }

        return $billable;
    }

    /**
     * Hourly rate in minor units per ClockifyImportPlan::rateKey(); null uses the rate order.
     *
     * @return array<string, int|null>
     */
    public function rates(): array
    {
        $rates = [];

        foreach ((array) $this->input('rates', []) as $choice) {
            if (! is_array($choice) || ! is_string($choice['project'] ?? null) || ! is_numeric($choice['member'] ?? null)) {
                continue;
            }

            $rate = $choice['rate'] ?? null;
            $rates[ClockifyImportPlan::rateKey($choice['project'], (int) $choice['member'])] = is_numeric($rate) ? (int) $rate : null;
        }

        return $rates;
    }

    /**
     * The project rows without a project go to; null skips them. ClockifyImportPlan only uses a
     * project of the organization.
     */
    public function projectForRowsWithoutProject(): ?int
    {
        return $this->filled('project_for_rows_without_project') ? $this->integer('project_for_rows_without_project') : null;
    }

    /**
     * Whether rows an earlier import created get the current rate and billable setting.
     */
    public function updateExisting(): bool
    {
        return $this->boolean('update_existing');
    }
}
