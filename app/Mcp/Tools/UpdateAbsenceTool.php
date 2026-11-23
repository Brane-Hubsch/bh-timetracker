<?php

namespace App\Mcp\Tools;

use App\Actions\Absences\UpdateAbsence;
use App\Data\AbsenceData;
use App\Enums\AbsenceType;
use App\Mcp\Support\McpContext;
use App\Models\Absence;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[IsIdempotent]
class UpdateAbsenceTool extends TimetrackerTool
{
    protected string $name = 'update_absence';

    protected string $description = 'Change an absence (find its id with list_absences). Only the given fields change; send hours_per_day null for full days and note null to clear it.';

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->integer()->description('Absence id.')->required(),
            'type' => $schema->string()->enum(array_column(AbsenceType::cases(), 'value'))->description('New type.'),
            'starts_on' => $schema->string()->description('New first day, YYYY-MM-DD.'),
            'ends_on' => $schema->string()->description('New last day (inclusive), YYYY-MM-DD.'),
            'hours_per_day' => $schema->string()->description('Hours per day, e.g. "4"; null for full days.'),
            'note' => $schema->string()->description('New note; null clears it.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, UpdateAbsence $updateAbsence): ResponseFactory
    {
        $request->validate([
            'id' => ['required', 'integer'],
            'type' => ['nullable', Rule::enum(AbsenceType::class)],
            'starts_on' => ['nullable', 'date_format:Y-m-d'],
            'ends_on' => ['nullable', 'date_format:Y-m-d'],
            'hours_per_day' => ['nullable', 'max:16'],
            'note' => ['nullable', 'string', 'max:'.Absence::MAX_NOTE_LENGTH],
        ]);
        $context = McpContext::from($request);
        $absence = Absence::query()->with('user:id,name')->find($id = $this->intArgument($request, 'id') ?? 0)
            ?? throw ValidationException::withMessages(['id' => "No absence with id {$id} in this organization."]);
        Gate::forUser($context->user)->authorize('update', $absence);

        $startsOn = $this->stringArgument($request, 'starts_on');
        $endsOn = $this->stringArgument($request, 'ends_on');

        $updateAbsence->handle($absence, new AbsenceData(
            userId: $absence->user_id,
            type: AbsenceType::tryFrom($this->stringArgument($request, 'type') ?? '') ?? $absence->type,
            startsOn: $startsOn !== null ? CarbonImmutable::parse($startsOn) : $absence->starts_on->toImmutable(),
            endsOn: $endsOn !== null ? CarbonImmutable::parse($endsOn) : $absence->ends_on->toImmutable(),
            secondsPerDay: $this->provided($request, 'hours_per_day') ? $this->absenceSecondsPerDay($request) : $absence->seconds_per_day,
            note: $this->provided($request, 'note') ? $this->stringArgument($request, 'note') : $absence->note,
        ));

        return Response::structured(['updated' => $this->absence($absence->refresh()->load('user:id,name'), $context)]);
    }
}
