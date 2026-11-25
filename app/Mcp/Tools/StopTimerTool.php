<?php

namespace App\Mcp\Tools;

use App\Actions\Timers\StopTimer;
use App\Actions\Timers\UpdateTimer;
use App\Data\TimerData;
use App\Enums\TimeEntrySource;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use App\Models\RunningTimer;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

class StopTimerTool extends TimetrackerTool
{
    protected string $name = 'stop_timer';

    protected string $description = 'Stop the user\'s running timer and save it as a time entry (to the minute). Give a project if the timer has none. If it has run for many hours, ask the user when they stopped and pass the end time.';

    public function __construct(private readonly Lookup $lookup)
    {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'project' => $schema->string()->description('Project id or name, if the timer has none or should change.'),
            'end' => $schema->string()->description('Local end time, HH:MM. Default: now. An end before the start time means the next day.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, UpdateTimer $updateTimer, StopTimer $stopTimer): ResponseFactory
    {
        $request->validate(['end' => ['nullable', 'date_format:H:i']]);
        $context = McpContext::from($request);
        $timer = RunningTimer::runningFor($context->user)
            ?? throw ValidationException::withMessages(['timer' => 'No timer is running.']);
        Gate::forUser($context->user)->authorize('update', $timer);

        $endedAt = null;

        if (($end = $this->stringArgument($request, 'end')) !== null) {
            $start = $timer->started_at->setTimezone($context->timezone());
            $endedAt = CarbonImmutable::parse($start->toDateString().' '.$end, $context->timezone());
            $endedAt = $endedAt->lessThanOrEqualTo($start) ? $endedAt->addDay() : $endedAt;
        }

        $projectReference = $this->stringArgument($request, 'project');

        $entry = DB::transaction(function () use ($context, $timer, $projectReference, $updateTimer, $stopTimer, $endedAt) {
            if ($projectReference !== null) {
                $project = $this->lookup->project($context, $projectReference, activeOnly: true);
                $updateTimer->handle($timer, new TimerData($project->id, $timer->started_at, $timer->description, $timer->is_billable, $timer->tags ?? []));
            }

            return $stopTimer->handle($timer, $endedAt, TimeEntrySource::Mcp);
        });

        return Response::structured(['saved' => $this->entry($entry->load(['project.client', 'user:id,name', 'tags']), $context)]);
    }
}
