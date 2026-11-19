<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use App\Services\Reports\ReportBuilder;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class GetProjectStatusTool extends TimetrackerTool
{
    protected string $name = 'get_project_status';

    protected string $description = 'Estimate vs hours used (by everyone) for one project or all active projects the user can access: estimate, used, remaining and percent.';

    public function __construct(
        private readonly Lookup $lookup,
        private readonly ReportBuilder $reports,
    ) {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'project' => $schema->string()->description('Project id or name. Omit for all active projects.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request): ResponseFactory
    {
        $context = McpContext::from($request);
        $projectId = $request->get('project') ? $this->lookup->project($context, $request->get('project'), activeOnly: true)->id : null;

        $projects = collect($this->reports->projectFollowUp($context->organization, $context->user))
            ->when($projectId, fn ($projects) => $projects->where('id', $projectId));

        return Response::structured([
            'projects' => $projects->map(fn (array $project) => array_filter([
                'id' => $project['id'],
                'name' => $project['name'],
                'client' => $project['clientName'],
                'estimate_hours' => $project['estimateSeconds'] !== null ? $this->hours($project['estimateSeconds']) : null,
                'used_hours' => $this->hours($project['consumedSeconds']),
                'billable_hours' => $this->hours($project['billableSeconds']),
                'remaining_hours' => $project['remainingSeconds'] !== null ? $this->hours($project['remainingSeconds']) : null,
                'percent_used' => $project['percent'],
            ], fn (mixed $value) => $value !== null))->values()->all(),
        ]);
    }
}
