<?php

namespace App\Mcp\Tools;

use App\Enums\OrganizationPermission;
use App\Enums\ReportPeriod;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use App\Models\TimeEntry;
use App\Services\Reports\ReportBuilder;
use App\Services\Reports\ReportFilters;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class ListTimeEntriesTool extends TimetrackerTool
{
    protected string $name = 'list_time_entries';

    protected string $description = 'List time entries in a period (default: this week), oldest first, with totals. Defaults to the user\'s own entries; owners and admins may pass another member or "all". Times are local to the user\'s time zone.';

    /** Most entries returned in one call. */
    private const int MAX_LIMIT = 500;

    public function __construct(
        private readonly Lookup $lookup,
        private readonly ReportBuilder $reports,
    ) {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            ...$this->periodArguments($schema),
            'member' => $schema->string()->description('Member id, email or name, or "all" (owners/admins). Default: the user.'),
            'project' => $schema->string()->description('Only entries on this project (id or name).'),
            'client' => $schema->string()->description('Only entries on this client\'s projects (id or name).'),
            'limit' => $schema->integer()->description('Maximum entries to return (1–500, default 100).'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request): ResponseFactory
    {
        $request->validate([...$this->periodRules(), 'limit' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_LIMIT]]);
        $context = McpContext::from($request);
        [$from, $to] = $this->period($request, $context, ReportPeriod::ThisWeek);

        $member = $request->get('member');
        $userIds = match (true) {
            $member === 'all' && $context->can(OrganizationPermission::ManageTeamTime) => [],
            $member === null || $member === '' => [$context->user->id],
            default => [$this->lookup->member($context, $member)->id],
        };

        $filters = new ReportFilters(
            organization: $context->organization,
            viewer: $context->user,
            from: $from,
            to: $to,
            userIds: $userIds,
            clientIds: $request->get('client') ? [$this->lookup->client($context, $request->get('client'))->id] : [],
            projectIds: $request->get('project') ? [$this->lookup->project($context, $request->get('project'))->id] : [],
        );

        $limit = is_numeric($request->get('limit')) ? (int) $request->get('limit') : 100;
        $entries = $this->reports->query($filters)
            ->with(['project.client', 'user:id,name', 'tags'])
            ->orderBy('started_at')
            ->limit($limit + 1)
            ->get();
        $totals = $this->reports->totalsFor($filters);

        return Response::structured(array_filter([
            'period' => ['from' => $from?->toDateString(), 'to' => $to?->toDateString()],
            'entries' => $entries->take($limit)->map(fn (TimeEntry $entry) => $this->entry($entry, $context))->values()->all(),
            'truncated' => $entries->count() > $limit ? "Only the first {$limit} entries are listed; narrow the period or raise the limit." : null,
            'totals' => array_filter([
                'hours' => $this->hours($totals['seconds']),
                'billable_hours' => $this->hours($totals['billableSeconds']),
                'amount' => $this->money($totals['amount']),
            ], fn (mixed $value) => $value !== null),
        ], fn (mixed $value) => $value !== null));
    }
}
