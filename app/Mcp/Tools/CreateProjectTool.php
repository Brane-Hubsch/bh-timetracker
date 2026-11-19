<?php

namespace App\Mcp\Tools;

use App\Actions\Projects\SaveProject;
use App\Enums\ProjectVisibility;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use App\Models\Project;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

class CreateProjectTool extends TimetrackerTool
{
    protected string $name = 'create_project';

    protected string $description = 'Create a project (owners and admins only), optionally for a client. Check with list_projects first that it does not already exist.';

    public function __construct(private readonly Lookup $lookup)
    {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'name' => $schema->string()->description('Project name.')->required(),
            'client' => $schema->string()->description('Client id or name. Omit for internal projects.'),
            'code' => $schema->string()->description('Short unique code, e.g. "ACME-02".'),
            'billable' => $schema->boolean()->description('Whether time is billable by default. Default true.'),
            'hourly_rate' => $schema->number()->description('Hourly rate in the organization currency (e.g. 1100 for 1 100 kr). Omit to use member/organization rates.'),
            'estimate_hours' => $schema->number()->description('Estimated hours.'),
            'private' => $schema->boolean()->description('Only assigned members can see it. Default false.'),
            'starts_on' => $schema->string()->description('Start date, YYYY-MM-DD.'),
            'ends_on' => $schema->string()->description('End date, YYYY-MM-DD.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, SaveProject $saveProject): ResponseFactory
    {
        $context = McpContext::from($request);
        Gate::forUser($context->user)->authorize('create', Project::class);

        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:32', Rule::unique('projects', 'code')->where('organization_id', $context->organization->id)],
            'billable' => ['nullable', 'boolean'],
            'hourly_rate' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'estimate_hours' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'private' => ['nullable', 'boolean'],
            'starts_on' => ['nullable', 'date_format:Y-m-d'],
            'ends_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:starts_on'],
        ]);

        $clientReference = $this->stringArgument($request, 'client');
        $client = $clientReference !== null ? $this->lookup->client($context, $clientReference) : null;
        $hourlyRate = $request->get('hourly_rate');
        $estimateHours = $request->get('estimate_hours');

        $project = $saveProject->handle($context->organization, [
            'name' => $this->stringArgument($request, 'name') ?? '',
            'client_id' => $client?->id,
            'code' => $this->stringArgument($request, 'code'),
            'color' => Project::COLORS[Project::query()->count() % count(Project::COLORS)],
            'is_billable' => $this->boolArgument($request, 'billable') ?? true,
            'hourly_rate' => is_numeric($hourlyRate) ? (int) round((float) $hourlyRate * 100) : null,
            'estimate_seconds' => is_numeric($estimateHours) ? (int) round((float) $estimateHours * 3600) : null,
            'visibility' => $this->boolArgument($request, 'private') ? ProjectVisibility::Private->value : ProjectVisibility::Public->value,
            'starts_on' => $this->stringArgument($request, 'starts_on'),
            'ends_on' => $this->stringArgument($request, 'ends_on'),
        ]);

        return Response::structured(['created' => [
            'id' => $project->id,
            'name' => $project->name,
            'client' => $client?->name,
        ]]);
    }
}
