<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use App\Models\Project;
use App\Services\Reports\ReportBuilder;
use App\Support\EstimatePace;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class GetProjectStatusTool extends TimetrackerTool
{
    protected string $name = 'get_project_status';

    protected string $description = 'Estimate vs hours used (by everyone) for one project or all active projects the user can access: estimate, used, remaining and percent. Projects with an estimate and an end date also get the working days left (from today, or the start date if later, to the end date; weekends and the organization\'s holidays excluded) and the hours needed per working day to reach the estimate.';

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
        $periods = Project::query()->whereIn('id', $projects->pluck('id'))
            ->get(['id', 'organization_id', 'estimate_seconds', 'starts_on', 'ends_on'])
            ->keyBy('id');

        return Response::structured([
            'projects' => $projects->map(function (array $project) use ($periods, $context) {
                $period = $periods->get($project['id']);
                $pace = $period ? EstimatePace::for($period, $project['consumedSeconds'], $context->today()) : null;

                return array_filter([
                    'id' => $project['id'],
                    'name' => $project['name'],
                    'client' => $project['clientName'],
                    'estimate_hours' => $project['estimateSeconds'] !== null ? $this->hours($project['estimateSeconds']) : null,
                    'used_hours' => $this->hours($project['consumedSeconds']),
                    'billable_hours' => $this->hours($project['billableSeconds']),
                    'remaining_hours' => $project['remainingSeconds'] !== null ? $this->hours($project['remainingSeconds']) : null,
                    'percent_used' => $project['percent'],
                    'starts_on' => $period?->starts_on?->toDateString(),
                    'ends_on' => $period?->ends_on?->toDateString(),
                    'working_days_left' => $pace['workdaysLeft'] ?? null,
                    'hours_per_working_day' => isset($pace['secondsPerWorkday']) ? $this->hours($pace['secondsPerWorkday']) : null,
                ], fn (mixed $value) => $value !== null);
            })->values()->all(),
        ]);
    }
}
