<?php

namespace App\Mcp\Tools;

use App\Enums\AbsenceType;
use App\Enums\OrganizationPermission;
use App\Enums\ReportPeriod;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use App\Models\Absence;
use App\Support\HolidayDates;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class ListAbsencesTool extends TimetrackerTool
{
    protected string $name = 'list_absences';

    protected string $description = 'List absence (vacation, care of a sick child, sick leave, parental leave, leave of absence, other) that overlaps a period (default: this month), with working days and hours. Defaults to the user\'s own absence. "all" lists everyone: owners and admins see everything, members see colleagues only as off (name and dates, no type or note). Use get_report for absence days per member and type.';

    public function __construct(private readonly Lookup $lookup)
    {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            ...$this->periodArguments($schema),
            'member' => $schema->string()->description('Member id, email or name (owners/admins), or "all". Default: the user.'),
            'type' => $schema->string()->enum(array_column(AbsenceType::cases(), 'value'))->description('Only this type of absence.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request): ResponseFactory
    {
        $request->validate([...$this->periodRules(), 'type' => ['nullable', Rule::enum(AbsenceType::class)]]);
        $context = McpContext::from($request);
        [$from, $to] = $this->period($request, $context, ReportPeriod::ThisMonth);
        $member = $this->stringArgument($request, 'member');
        $everyone = $member === 'all';
        $userId = match (true) {
            $everyone => null,
            $member === null => $context->user->id,
            default => $this->lookup->member($context, $member)->id,
        };
        $type = AbsenceType::tryFrom($this->stringArgument($request, 'type') ?? '');
        $canSeeAll = $context->can(OrganizationPermission::ManageTeamTime);

        $absences = Absence::query()
            ->when($from, fn (Builder $query, CarbonImmutable $date) => $query->whereDate('ends_on', '>=', $date->toDateString()))
            ->when($to, fn (Builder $query, CarbonImmutable $date) => $query->whereDate('starts_on', '<=', $date->toDateString()))
            ->whereIn('user_id', $context->organization->members()->wherePivotNull('deactivated_at')->select('users.id'))
            ->when($userId !== null, fn (Builder $query) => $query->where('user_id', $userId))
            // Members don't see colleagues' types, so a type filter only covers their own absence.
            ->when($type !== null, fn (Builder $query) => $query->where('type', $type)->when(! $canSeeAll, fn (Builder $query) => $query->where('user_id', $context->user->id)))
            ->with('user:id,name')
            ->orderBy('starts_on')
            ->limit(500)
            ->get();

        // One holiday lookup covering every listed absence, also outside the period.
        $earliest = $latest = null;

        foreach ($absences as $absence) {
            $earliest = $earliest === null || $absence->starts_on->lessThan($earliest) ? $absence->starts_on->toImmutable() : $earliest;
            $latest = $latest === null || $absence->ends_on->greaterThan($latest) ? $absence->ends_on->toImmutable() : $latest;
        }

        $holidays = $earliest !== null ? HolidayDates::between($context->organization->id, $earliest, $latest) : [];

        return Response::structured([
            'period' => ['from' => $from?->toDateString(), 'to' => $to?->toDateString()],
            'workday_hours' => $this->hours($context->organization->workday_seconds),
            'absences' => $absences->map(fn (Absence $absence) => $canSeeAll || $absence->user_id === $context->user->id
                ? $this->absence($absence, $context, $holidays)
                : [
                    'member' => ['id' => $absence->user_id, 'name' => $absence->user->name],
                    'off' => true,
                    'starts_on' => $absence->starts_on->toDateString(),
                    'ends_on' => $absence->ends_on->toDateString(),
                ])->values()->all(),
        ]);
    }
}
