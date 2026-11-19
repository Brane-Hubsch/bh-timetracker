<?php

namespace App\Mcp\Tools;

use App\Enums\OrganizationPermission;
use App\Enums\ReportPeriod;
use App\Mcp\Support\McpContext;
use App\Models\TimeEntry;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\JsonSchema\Types\Type;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Server\Tool;

/**
 * Shared helpers for the BH Timetracker MCP tools: organization argument, periods in the user's
 * time zone and a compact JSON shape for time entries (hours as decimals, local times).
 */
abstract class TimetrackerTool extends Tool
{
    protected function organizationArgument(JsonSchema $schema): Type
    {
        return $schema->string()->description('Organization slug (see get_context). Defaults to the active organization.');
    }

    /**
     * @return array<string, Type>
     */
    protected function periodArguments(JsonSchema $schema): array
    {
        return [
            'period' => $schema->string()
                ->enum(array_column(ReportPeriod::cases(), 'value'))
                ->description('A preset period in the user\'s time zone. Ignored when "from" is given.'),
            'from' => $schema->string()->description('First day (YYYY-MM-DD), inclusive, in the user\'s time zone.'),
            'to' => $schema->string()->description('Last day (YYYY-MM-DD), inclusive. Defaults to "from".'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function periodRules(): array
    {
        return [
            'period' => ['nullable', Rule::enum(ReportPeriod::class)],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ];
    }

    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    protected function period(Request $request, McpContext $context, ReportPeriod $default = ReportPeriod::ThisWeek): array
    {
        $from = $this->stringArgument($request, 'from');
        $to = $this->stringArgument($request, 'to');

        if ($from !== null) {
            return ReportPeriod::Custom->range(
                $context->today(),
                $context->organization->week_starts_on,
                CarbonImmutable::parse($from),
                $to !== null ? CarbonImmutable::parse($to) : null,
            );
        }

        $period = ReportPeriod::tryFrom($this->stringArgument($request, 'period') ?? '') ?? $default;

        return $period->range($context->today(), $context->organization->week_starts_on);
    }

    /**
     * A non-empty string argument, or null.
     */
    protected function stringArgument(Request $request, string $key): ?string
    {
        $value = $request->get($key);

        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }

        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }

    protected function intArgument(Request $request, string $key): ?int
    {
        $value = $request->get($key);

        return is_numeric($value) ? (int) $value : null;
    }

    protected function boolArgument(Request $request, string $key): ?bool
    {
        $value = $request->get($key);

        return $value === null ? null : filter_var($value, FILTER_VALIDATE_BOOL);
    }

    protected function hours(int $seconds): float
    {
        return round($seconds / 3600, 2);
    }

    /**
     * Minor units (öre) to the currency's major unit, or null when hidden.
     */
    protected function money(?int $minorUnits): ?float
    {
        return $minorUnits === null ? null : round($minorUnits / 100, 2);
    }

    /**
     * @return array<string, mixed>
     */
    protected function entry(TimeEntry $entry, McpContext $context): array
    {
        $start = $entry->started_at->setTimezone($context->timezone());
        $end = $entry->ended_at->setTimezone($context->timezone());
        $showAmounts = $context->can(OrganizationPermission::ViewRates);

        return array_filter([
            'id' => $entry->id,
            'date' => $start->toDateString(),
            'start' => $start->format('H:i'),
            'end' => $end->format('H:i').($end->isSameDay($start) ? '' : ' (+1 day)'),
            'hours' => $this->hours($entry->duration_seconds),
            'member' => ['id' => $entry->user_id, 'name' => $entry->user->name],
            'project' => ['id' => $entry->project_id, 'name' => $entry->project->name],
            'client' => $entry->project->client?->name,
            'description' => $entry->description,
            'tags' => $entry->tagNames(),
            'billable' => $entry->is_billable,
            'hourly_rate' => $showAmounts ? $this->money($entry->hourly_rate) : null,
            'source' => $entry->source->value,
        ], fn (mixed $value) => $value !== null);
    }
}
