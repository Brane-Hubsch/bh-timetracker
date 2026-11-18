<?php

namespace App\Http\Requests\Reports;

use App\Enums\ReportGrouping;
use App\Enums\ReportPeriod;
use App\Models\Organization;
use App\Models\User;
use App\Services\Reports\ReportFilters;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Report filters from the query string, so reports can be bookmarked and shared internally.
 */
class ReportRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'period' => ['nullable', Rule::enum(ReportPeriod::class)],
            'from' => ['nullable', 'required_if:period,custom', 'date_format:Y-m-d'],
            'to' => ['nullable', 'required_if:period,custom', 'date_format:Y-m-d', 'after_or_equal:from'],
            'members' => ['nullable', 'array', 'max:200'],
            'members.*' => ['integer'],
            'clients' => ['nullable', 'array', 'max:200'],
            'clients.*' => ['integer'],
            'projects' => ['nullable', 'array', 'max:500'],
            'projects.*' => ['integer'],
            'billable' => ['nullable', 'boolean'],
            'group' => ['nullable', Rule::enum(ReportGrouping::class)],
            'subgroup' => ['nullable', Rule::in([...array_column(ReportGrouping::cases(), 'value'), 'none'])],
            'sort' => ['nullable', Rule::in(['date', 'duration', 'project', 'member'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
        ];
    }

    public function period(): ReportPeriod
    {
        return $this->enum('period', ReportPeriod::class) ?? ReportPeriod::ThisMonth;
    }

    public function grouping(): ReportGrouping
    {
        return $this->enum('group', ReportGrouping::class) ?? ReportGrouping::Client;
    }

    /**
     * Second level; defaults to projects (or none when grouping by project), `none` turns it off.
     */
    public function subGrouping(): ?ReportGrouping
    {
        if (! $this->filled('subgroup')) {
            return $this->grouping() === ReportGrouping::Project ? null : ReportGrouping::Project;
        }

        $subGrouping = ReportGrouping::tryFrom($this->string('subgroup')->value());

        return $subGrouping === $this->grouping() ? null : $subGrouping;
    }

    /**
     * @return 'date'|'duration'|'project'|'member'
     */
    public function sort(): string
    {
        return match ($this->string('sort')->value()) {
            'duration' => 'duration',
            'project' => 'project',
            'member' => 'member',
            default => 'date',
        };
    }

    /**
     * @return 'asc'|'desc'
     */
    public function direction(): string
    {
        return $this->string('direction')->value() === 'asc' ? 'asc' : 'desc';
    }

    public function billable(): ?bool
    {
        return $this->filled('billable') ? $this->boolean('billable') : null;
    }

    public function filters(User $viewer, Organization $organization): ReportFilters
    {
        $timezone = $viewer->timezone;
        [$from, $to] = $this->period()->range(
            CarbonImmutable::now($timezone),
            $organization->week_starts_on,
            $this->date('from', 'Y-m-d', $timezone)?->toImmutable(),
            $this->date('to', 'Y-m-d', $timezone)?->toImmutable(),
        );

        return new ReportFilters(
            organization: $organization,
            viewer: $viewer,
            from: $from,
            to: $to,
            userIds: $this->ids('members'),
            clientIds: $this->ids('clients'),
            projectIds: $this->ids('projects'),
            billable: $this->billable(),
        );
    }

    /**
     * The filters as sent to the page (to prefill the controls).
     *
     * @return array{period: string, from: string, to: string, members: array<int, string>, clients: array<int, string>, projects: array<int, string>, billable: string|null, group: string, subgroup: string, sort: string, direction: string}
     */
    public function echo(ReportFilters $filters): array
    {
        $strings = fn (array $ids) => array_map(fn (int $id) => (string) $id, $ids);

        return [
            'period' => $this->period()->value,
            'from' => $filters->from?->toDateString() ?? '',
            'to' => $filters->to?->toDateString() ?? '',
            'members' => $strings($filters->userIds),
            'clients' => $strings($filters->clientIds),
            'projects' => $strings($filters->projectIds),
            'billable' => $filters->billable === null ? null : ($filters->billable ? '1' : '0'),
            'group' => $this->grouping()->value,
            'subgroup' => $this->subGrouping()->value ?? 'none',
            'sort' => $this->sort(),
            'direction' => $this->direction(),
        ];
    }

    /**
     * @return array<int, int>
     */
    private function ids(string $key): array
    {
        return collect($this->array($key))
            ->filter(fn (mixed $id) => is_numeric($id))
            ->map(fn (mixed $id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }
}
