<?php

namespace App\Mcp\Tools;

use App\Enums\ReportGrouping;
use App\Enums\ReportPeriod;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use App\Services\Reports\ReportBuilder;
use App\Services\Reports\ReportFilters;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class GetReportTool extends TimetrackerTool
{
    protected string $name = 'get_report';

    protected string $description = 'Summarised time for a period (default: this month), grouped in up to two levels (client, project, member, tag, day, week, month), as in the Reports page. Grouped by tag, an entry with several tags counts under each of them. Members only get their own time; amounts (in the organization currency) only for owners and admins.';

    public function __construct(
        private readonly Lookup $lookup,
        private readonly ReportBuilder $reports,
    ) {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        $groupings = array_column(ReportGrouping::cases(), 'value');

        return [
            ...$this->periodArguments($schema),
            'group_by' => $schema->string()->enum($groupings)->description('First level. Default "client".'),
            'then_by' => $schema->string()->enum($groupings)->description('Optional second level.'),
            'members' => $schema->array()->items($schema->string())->description('Member ids, emails or names (owners/admins).'),
            'clients' => $schema->array()->items($schema->string())->description('Client ids or names.'),
            'projects' => $schema->array()->items($schema->string())->description('Project ids or names.'),
            'tags' => $schema->array()->items($schema->string())->description('Tag ids or names; entries with any of them.'),
            'billable' => $schema->boolean()->description('Only billable (true) or non-billable (false) time.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request): ResponseFactory
    {
        $request->validate([
            ...$this->periodRules(),
            'group_by' => ['nullable', Rule::enum(ReportGrouping::class)],
            'then_by' => ['nullable', Rule::enum(ReportGrouping::class)],
            'members' => ['nullable', 'array', 'max:50'],
            'clients' => ['nullable', 'array', 'max:50'],
            'projects' => ['nullable', 'array', 'max:50'],
            'tags' => ['nullable', 'array', 'max:50'],
            'billable' => ['nullable', 'boolean'],
        ]);
        $context = McpContext::from($request);
        [$from, $to] = $this->period($request, $context, ReportPeriod::ThisMonth);
        $grouping = ReportGrouping::tryFrom($this->stringArgument($request, 'group_by') ?? '') ?? ReportGrouping::Client;
        $subGrouping = ReportGrouping::tryFrom($this->stringArgument($request, 'then_by') ?? '');

        $filters = new ReportFilters(
            organization: $context->organization,
            viewer: $context->user,
            from: $from,
            to: $to,
            userIds: $this->references($request, 'members', fn (mixed $reference, string $field) => $this->lookup->member($context, $reference, $field)->id),
            clientIds: $this->references($request, 'clients', fn (mixed $reference, string $field) => $this->lookup->client($context, $reference, $field)->id),
            projectIds: $this->references($request, 'projects', fn (mixed $reference, string $field) => $this->lookup->project($context, $reference, $field)->id),
            billable: $this->boolArgument($request, 'billable'),
            tagIds: $this->references($request, 'tags', fn (mixed $reference, string $field) => $this->lookup->tag($context, $reference, $field)->id),
        );

        $summary = $this->reports->summary($filters, $grouping, $subGrouping);

        return Response::structured([
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'scope' => $filters->canViewTeam() ? 'team' : 'own time only',
            'currency' => $filters->canViewAmounts() ? $context->organization->currency : null,
            'totals' => $this->totals($summary['totals']),
            'groups' => array_map(fn (array $group) => [
                ...$this->label($group, $grouping),
                ...$this->totals($group),
                ...($subGrouping && $subGrouping !== $grouping ? [
                    'children' => array_map(fn (array $child) => [
                        ...$this->label($child, $subGrouping),
                        ...$this->totals($child),
                    ], $group['children']),
                ] : []),
            ], $summary['groups']),
        ]);
    }

    /**
     * @param  array{key: string, label: string}  $group
     * @return array<string, string>
     */
    private function label(array $group, ReportGrouping $grouping): array
    {
        return $grouping->isTime()
            ? [$grouping->value => $group['key']]
            : [$grouping->value => $group['label']];
    }

    /**
     * @param  array{seconds: int, billableSeconds: int, amount: int|null}  $totals
     * @return array<string, float>
     */
    private function totals(array $totals): array
    {
        return array_filter([
            'hours' => $this->hours($totals['seconds']),
            'billable_hours' => $this->hours($totals['billableSeconds']),
            'amount' => $this->money($totals['amount']),
        ], fn (mixed $value) => $value !== null);
    }
}
