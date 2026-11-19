<?php

namespace App\Mcp\Tools;

use App\Actions\TimeEntries\UpdateTimeEntry;
use App\Data\TimeEntryData;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use App\Models\Tag;
use App\Models\TimeEntry;
use App\Support\DurationParser;
use App\Support\LocalTimes;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[IsIdempotent]
class UpdateTimeEntryTool extends TimetrackerTool
{
    protected string $name = 'update_time_entry';

    protected string $description = 'Change a time entry (find its id with list_time_entries). Only the given fields change; moving the date or start keeps the duration unless an end or duration is given. Times are local to the user\'s time zone.';

    public function __construct(
        private readonly Lookup $lookup,
        private readonly DurationParser $durations,
    ) {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->integer()->description('Time entry id.')->required(),
            'project' => $schema->string()->description('New project (id or name).'),
            'date' => $schema->string()->description('New local date, YYYY-MM-DD.'),
            'start' => $schema->string()->description('New local start time, HH:MM.'),
            'end' => $schema->string()->description('New local end time, HH:MM.'),
            'duration' => $schema->string()->description('New duration instead of end, e.g. "2", "1:30", "45m".'),
            'description' => $schema->string()->description('New description (empty string clears it).'),
            'billable' => $schema->boolean()->description('Billable or not.'),
            'tags' => $schema->array()->items($schema->string())->max(Tag::MAX_PER_ENTRY)->description('Replaces all tags (names; new ones are created). [] removes them; leave out to keep them.'),
            'member' => $schema->string()->description('Move the entry to another member (owners/admins).'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, UpdateTimeEntry $updateTimeEntry): ResponseFactory
    {
        $request->validate([
            'id' => ['required', 'integer'],
            'date' => ['nullable', 'date_format:Y-m-d'],
            'start' => ['nullable', 'date_format:H:i'],
            'end' => ['nullable', 'date_format:H:i'],
            'duration' => ['nullable', 'string', 'max:32'],
            'description' => ['nullable', 'string', 'max:5000'],
            'billable' => ['nullable', 'boolean'],
            'tags' => ['nullable', 'array', 'max:'.Tag::MAX_PER_ENTRY],
            'tags.*' => ['string', 'max:'.Tag::MAX_NAME_LENGTH],
        ]);

        $context = McpContext::from($request);
        $entry = TimeEntry::query()->with('user')->find($id = $this->intArgument($request, 'id') ?? 0)
            ?? throw ValidationException::withMessages(['id' => "No time entry with id {$id} in this organization."]);
        Gate::forUser($context->user)->authorize('update', $entry);

        $memberReference = $this->stringArgument($request, 'member');
        $member = $memberReference !== null ? $this->lookup->member($context, $memberReference) : $entry->user;
        Gate::forUser($context->user)->authorize('manageFor', [TimeEntry::class, $context->organization, $member]);

        $timezone = $context->timezone();
        $localStart = $entry->started_at->setTimezone($timezone);
        $end = $this->stringArgument($request, 'end');
        $durationInput = $this->stringArgument($request, 'duration');
        $duration = $end === null ? $this->durations->parse($durationInput) : null;

        if ($end === null && $durationInput !== null && ($duration === null || $duration <= 0)) {
            throw ValidationException::withMessages(['duration' => 'Give a duration such as "1,5", "1:30" or "90m".']);
        }

        [$startedAt, $endedAt] = LocalTimes::toUtc(
            $this->stringArgument($request, 'date') ?? $localStart->toDateString(),
            $this->stringArgument($request, 'start') ?? $localStart->format('H:i'),
            $end,
            $duration ?? $entry->duration_seconds,
            $timezone,
        );

        $description = $request->get('description');
        $projectReference = $this->stringArgument($request, 'project');

        $updateTimeEntry->handle($entry, new TimeEntryData(
            userId: $member->id,
            projectId: $projectReference !== null ? $this->lookup->project($context, $projectReference, activeOnly: true)->id : $entry->project_id,
            startedAt: $startedAt,
            endedAt: $endedAt,
            description: is_string($description) ? (trim($description) === '' ? null : $description) : $entry->description,
            isBillable: $this->boolArgument($request, 'billable') ?? $entry->is_billable,
            source: $entry->source,
            tags: is_array($tags = $request->get('tags')) ? array_values(array_filter($tags, 'is_string')) : null,
        ));

        return Response::structured(['updated' => $this->entry($entry->refresh()->load(['project.client', 'user:id,name', 'tags']), $context)]);
    }
}
