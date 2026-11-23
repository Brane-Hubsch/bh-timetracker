<?php

namespace App\Mcp\Tools;

use App\Enums\ReportGrouping;
use App\Enums\ReportPeriod;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class ExportReportTool extends TimetrackerTool
{
    protected string $name = 'export_report';

    protected string $description = 'Export a report as a PDF, Excel (XLSX) or CSV file. Returns a download link for the user to open in their browser while signed in to BH Timetracker, plus a link to the same report in the app; you cannot read the file yourself (use get_report for the numbers). The export applies the same permissions as the app: members only get their own time and no amounts.';

    public function __construct(private readonly Lookup $lookup)
    {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        $groupings = array_column(ReportGrouping::cases(), 'value');

        return [
            'type' => $schema->string()->enum(['summary', 'detailed'])->description('"summary" (grouped totals, default) or "detailed" (every entry).'),
            'format' => $schema->string()->enum(['pdf', 'xlsx', 'csv'])->description('File format. Default "pdf".'),
            ...$this->periodArguments($schema),
            'group_by' => $schema->string()->enum($groupings)->description('Summary only: first level. Default "client".'),
            'then_by' => $schema->string()->enum($groupings)->description('Summary only: optional second level.'),
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
            'type' => ['nullable', Rule::in(['summary', 'detailed'])],
            'format' => ['nullable', Rule::in(['pdf', 'xlsx', 'csv'])],
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
        $type = $this->stringArgument($request, 'type') ?? 'summary';
        $format = $this->stringArgument($request, 'format') ?? 'pdf';
        $billable = $this->boolArgument($request, 'billable');

        // The same query the report pages use, so the app checks access again when the link is opened.
        $query = array_filter([
            'period' => ($from === null ? ReportPeriod::AllTime : ReportPeriod::Custom)->value,
            'from' => $from?->toDateString(),
            'to' => $to?->toDateString(),
            'members' => $this->references($request, 'members', fn (mixed $reference, string $field) => $this->lookup->member($context, $reference, $field)->id),
            'clients' => $this->references($request, 'clients', fn (mixed $reference, string $field) => $this->lookup->client($context, $reference, $field)->id),
            'projects' => $this->references($request, 'projects', fn (mixed $reference, string $field) => $this->lookup->project($context, $reference, $field)->id),
            'tags' => $this->references($request, 'tags', fn (mixed $reference, string $field) => $this->lookup->tag($context, $reference, $field)->id),
            'billable' => $billable === null ? null : ($billable ? '1' : '0'),
            ...($type === 'summary' ? [
                'group' => $this->stringArgument($request, 'group_by') ?? ReportGrouping::Client->value,
                'subgroup' => $this->stringArgument($request, 'then_by') ?? 'none',
            ] : []),
        ], fn (mixed $value) => $value !== null && $value !== []);

        $organization = ['current_organization' => $context->organization->slug];

        return Response::structured([
            'download_url' => route('reports.export', [...$organization, 'type' => $type, 'format' => $format, ...$query]),
            'report_url' => route($type === 'summary' ? 'reports.summary' : 'reports.detailed', [...$organization, ...$query]),
            'type' => $type,
            'format' => $format,
            'period' => ['from' => $from?->toDateString(), 'to' => $to?->toDateString()],
        ]);
    }
}
