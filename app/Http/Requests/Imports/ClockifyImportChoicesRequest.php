<?php

namespace App\Http\Requests\Imports;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The choices made in the import preview: which member each Clockify user's time goes to (or
 * "skip"), and whether new projects are billable. Sent as lists, since emails and project keys
 * contain characters that don't work as input names.
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
        ];
    }

    /**
     * Email => member id, or null to skip that user. Users not listed match on email.
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
            $map[mb_strtolower($choice['email'])] = is_string($member) && ctype_digit($member) ? (int) $member : null;
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
}
