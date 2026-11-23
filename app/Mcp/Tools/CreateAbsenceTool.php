<?php

namespace App\Mcp\Tools;

use App\Actions\Absences\CreateAbsence;
use App\Data\AbsenceData;
use App\Enums\AbsenceType;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use App\Models\Absence;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

class CreateAbsenceTool extends TimetrackerTool
{
    protected string $name = 'create_absence';

    protected string $description = 'Register absence for a period of days: full working days, or some hours per day (e.g. 4 hours of care of a sick child). Weekends and the organization\'s holidays don\'t count. Absence is not time worked and is kept apart from time entries. Owners and admins can register it for other members.';

    public function __construct(private readonly Lookup $lookup)
    {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'type' => $schema->string()->enum(array_column(AbsenceType::cases(), 'value'))->description('vacation, child_care (care of a sick child, "VAB"), sick, parental_leave, leave_of_absence or other.')->required(),
            'starts_on' => $schema->string()->description('First day, YYYY-MM-DD.')->required(),
            'ends_on' => $schema->string()->description('Last day (inclusive), YYYY-MM-DD. Default: the first day.'),
            'hours_per_day' => $schema->string()->description('Hours per day, e.g. "4" or "4:30". Leave out for full days.'),
            'note' => $schema->string()->description('Optional note.'),
            'member' => $schema->string()->description('Member id, email or name (owners/admins). Default: the user.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, CreateAbsence $createAbsence): ResponseFactory
    {
        $request->validate([
            'type' => ['required', Rule::enum(AbsenceType::class)],
            'starts_on' => ['required', 'date_format:Y-m-d'],
            'ends_on' => ['nullable', 'date_format:Y-m-d'],
            'hours_per_day' => ['nullable', 'max:16'],
            'note' => ['nullable', 'string', 'max:'.Absence::MAX_NOTE_LENGTH],
        ]);
        $context = McpContext::from($request);
        $memberReference = $this->stringArgument($request, 'member');
        $member = $memberReference !== null ? $this->lookup->member($context, $memberReference) : $context->user;
        Gate::forUser($context->user)->authorize('manageFor', [Absence::class, $context->organization, $member]);

        $startsOn = $this->stringArgument($request, 'starts_on') ?? '';
        $absence = $createAbsence->handle($context->organization, new AbsenceData(
            userId: $member->id,
            type: AbsenceType::from($this->stringArgument($request, 'type') ?? ''),
            startsOn: CarbonImmutable::parse($startsOn),
            endsOn: CarbonImmutable::parse($this->stringArgument($request, 'ends_on') ?? $startsOn),
            secondsPerDay: $this->absenceSecondsPerDay($request),
            note: $this->stringArgument($request, 'note'),
        ));

        return Response::structured(['created' => $this->absence($absence->load('user:id,name'), $context)]);
    }
}
