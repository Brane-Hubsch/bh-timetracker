<?php

namespace App\Mcp\Tools;

use App\Actions\TimeEntries\CreateTimeEntries;
use App\Data\TimeEntryData;
use App\Enums\TimeEntrySource;
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

class CreateTimeEntriesTool extends TimetrackerTool
{
    protected string $name = 'create_time_entries';

    protected string $description = 'Create one or more time entries in one call (all or nothing), e.g. to fill in a week from notes. Times are local to the user\'s time zone; give an end time or a duration. Confirm with the user before creating many entries.';

    /** Most entries created in one call. */
    private const int MAX_ENTRIES = 50;

    public function __construct(
        private readonly Lookup $lookup,
        private readonly DurationParser $durations,
    ) {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'entries' => $schema->array()->items($schema->object([
                'project' => $schema->string()->description('Project id or name, e.g. "Acme webbshop".')->required(),
                'date' => $schema->string()->description('Local date, YYYY-MM-DD.')->required(),
                'start' => $schema->string()->description('Local start time, HH:MM (24 h).')->required(),
                'end' => $schema->string()->description('Local end time, HH:MM. An end before the start means the next day.'),
                'duration' => $schema->string()->description('Instead of end: "1,5", "1.5", "1:30", "90m" or "1h 30m".'),
                'description' => $schema->string()->description('What was done.'),
                'billable' => $schema->boolean()->description('Defaults to the project\'s setting.'),
                'tags' => $schema->array()->items($schema->string())->max(Tag::MAX_PER_ENTRY)->description('Tag names, e.g. ["Möte"]. Existing tags are matched case-insensitively; new ones are created (see get_context for the list).'),
                'member' => $schema->string()->description('Member id, email or name to report for (owners/admins). Default: the user.'),
            ]))->min(1)->max(self::MAX_ENTRIES)->required(),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, CreateTimeEntries $createTimeEntries): ResponseFactory
    {
        $request->validate([
            'entries' => ['required', 'array', 'min:1', 'max:'.self::MAX_ENTRIES],
            'entries.*.project' => ['required'],
            'entries.*.date' => ['required', 'date_format:Y-m-d'],
            'entries.*.start' => ['required', 'date_format:H:i'],
            'entries.*.end' => ['nullable', 'required_without:entries.*.duration', 'date_format:H:i'],
            'entries.*.duration' => ['nullable', 'string', 'max:32'],
            'entries.*.description' => ['nullable', 'string', 'max:5000'],
            'entries.*.billable' => ['nullable', 'boolean'],
            'entries.*.tags' => ['nullable', 'array', 'max:'.Tag::MAX_PER_ENTRY],
            'entries.*.tags.*' => ['string', 'max:'.Tag::MAX_NAME_LENGTH],
        ], [
            'entries.*.end.required_without' => 'Entry :position needs an end time or a duration.',
        ]);

        $context = McpContext::from($request);
        /** @var array<int, array<string, mixed>> $input */
        $input = array_values((array) $request->get('entries'));
        $data = [];

        foreach ($input as $index => $entry) {
            $value = fn (string $key): ?string => isset($entry[$key]) && (is_string($entry[$key]) || is_int($entry[$key])) && trim((string) $entry[$key]) !== ''
                ? trim((string) $entry[$key])
                : null;

            $memberReference = $value('member');
            $member = $memberReference !== null ? $this->lookup->member($context, $memberReference, "entries.{$index}.member") : $context->user;
            Gate::forUser($context->user)->authorize('manageFor', [TimeEntry::class, $context->organization, $member]);

            $project = $this->lookup->project($context, $value('project'), "entries.{$index}.project", activeOnly: true);
            $end = $value('end');
            $duration = $end === null ? $this->durations->parse($value('duration')) : null;

            if ($end === null && ($duration === null || $duration <= 0)) {
                throw ValidationException::withMessages(["entries.{$index}.duration" => 'Give a duration such as "1,5", "1:30" or "90m", or an end time.']);
            }

            [$startedAt, $endedAt] = LocalTimes::toUtc($value('date') ?? '', $value('start') ?? '', $end, $duration, $context->timezone());

            $data[] = new TimeEntryData(
                userId: $member->id,
                projectId: $project->id,
                startedAt: $startedAt,
                endedAt: $endedAt,
                description: $value('description'),
                isBillable: isset($entry['billable']) ? filter_var($entry['billable'], FILTER_VALIDATE_BOOL) : null,
                source: TimeEntrySource::Mcp,
                tags: isset($entry['tags']) && is_array($entry['tags']) ? array_values(array_filter($entry['tags'], 'is_string')) : null,
            );
        }

        $created = $createTimeEntries->handle($context->organization, $data)
            ->each(fn (TimeEntry $entry) => $entry->load(['project.client', 'user:id,name', 'tags']));

        return Response::structured([
            'created' => $created->map(fn (TimeEntry $entry) => $this->entry($entry, $context))->values()->all(),
            'total_hours' => $this->hours(array_sum($created->map(fn (TimeEntry $entry) => $entry->duration_seconds)->all())),
        ]);
    }
}
