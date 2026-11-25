<?php

namespace App\Mcp\Tools;

use App\Actions\Timers\StartTimer;
use App\Data\TimerData;
use App\Enums\TimeEntrySource;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use App\Models\RunningTimer;
use App\Models\Tag;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

class StartTimerTool extends TimetrackerTool
{
    protected string $name = 'start_timer';

    protected string $description = 'Start the user\'s timer (time is measured until stop_timer). The project may be given now or when stopping. Starting while a timer runs saves the running one first, ending where the new one starts. Only for the user themselves.';

    public function __construct(private readonly Lookup $lookup)
    {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'project' => $schema->string()->description('Project id or name. Optional; needed before stopping.'),
            'description' => $schema->string()->description('What the user is working on.'),
            'tags' => $schema->array()->items($schema->string())->max(Tag::MAX_PER_ENTRY)->description('Tag names; new ones are created.'),
            'billable' => $schema->boolean()->description('Billable or not. Default: the project\'s setting.'),
            'start' => $schema->string()->description('Local start time today, HH:MM, if the user started earlier. Default: now.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, StartTimer $startTimer): ResponseFactory
    {
        $request->validate([
            'description' => ['nullable', 'string', 'max:5000'],
            'tags' => ['nullable', 'array', 'max:'.Tag::MAX_PER_ENTRY],
            'tags.*' => ['string', 'max:'.Tag::MAX_NAME_LENGTH],
            'billable' => ['nullable', 'boolean'],
            'start' => ['nullable', 'date_format:H:i'],
        ]);
        $context = McpContext::from($request);
        $projectReference = $this->stringArgument($request, 'project');
        $start = $this->stringArgument($request, 'start');
        $previous = RunningTimer::runningFor($context->user);
        $tags = $request->get('tags');

        $timer = $startTimer->handle($context->organization, $context->user, new TimerData(
            projectId: $projectReference !== null ? $this->lookup->project($context, $projectReference, activeOnly: true)->id : null,
            startedAt: $start !== null ? CarbonImmutable::parse($context->today()->toDateString().' '.$start, $context->timezone()) : CarbonImmutable::now(),
            description: $this->stringArgument($request, 'description'),
            isBillable: $this->boolArgument($request, 'billable'),
            tags: is_array($tags) ? array_values(array_filter($tags, 'is_string')) : [],
        ), TimeEntrySource::Mcp);

        return Response::structured(array_filter([
            'started' => $this->timer($timer->load(['organization', 'project.client']), $context),
            'saved_previous_timer' => $previous !== null ?: null,
        ], fn (mixed $value) => $value !== null));
    }
}
