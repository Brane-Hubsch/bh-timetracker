<?php

namespace App\Mcp\Tools;

use App\Enums\OrganizationPermission;
use App\Enums\ProjectVisibility;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use App\Models\Project;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class ListProjectsTool extends TimetrackerTool
{
    protected string $name = 'list_projects';

    protected string $description = 'Search projects the user can report time on, with client, estimate and hours used so far. Use the returned id when creating time entries if a name is ambiguous.';

    public function __construct(private readonly Lookup $lookup)
    {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'search' => $schema->string()->description('Part of the project name, code or client name.'),
            'client' => $schema->string()->description('Only projects of this client (id or name).'),
            'include_archived' => $schema->boolean()->description('Include archived projects. Default false.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request): ResponseFactory
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'client' => ['nullable'],
            'include_archived' => ['nullable', 'boolean'],
        ]);
        $context = McpContext::from($request);
        $clientReference = $this->stringArgument($request, 'client');
        $client = $clientReference !== null ? $this->lookup->client($context, $clientReference) : null;
        $search = $this->stringArgument($request, 'search');
        $showRates = $context->can(OrganizationPermission::ViewRates);

        $projects = Project::query()
            ->accessibleBy($context->user, $context->organization)
            ->with('client')
            ->when($client, fn (Builder $query) => $query->where('client_id', $client?->id))
            ->when(! $request->get('include_archived'), fn (Builder $query) => $query->active())
            ->when($search !== null, fn (Builder $query) => $query->search($search))
            ->withSum('timeEntries as consumed_seconds', 'duration_seconds')
            ->orderBy('name')
            ->limit(200)
            ->get();

        return Response::structured([
            'projects' => $projects->map(function (Project $project) use ($showRates) {
                $consumed = is_numeric($project->getAttribute('consumed_seconds')) ? (int) $project->getAttribute('consumed_seconds') : 0;

                return array_filter([
                    'id' => $project->id,
                    'name' => $project->name,
                    'code' => $project->code,
                    'client' => $project->client ? ['id' => $project->client->id, 'name' => $project->client->name] : null,
                    'billable' => $project->is_billable,
                    'hourly_rate' => $showRates ? $this->money($project->hourly_rate) : null,
                    'estimate_hours' => $project->estimate_seconds !== null ? $this->hours($project->estimate_seconds) : null,
                    'used_hours' => $this->hours($consumed),
                    'remaining_hours' => $project->estimate_seconds !== null ? $this->hours($project->estimate_seconds - $consumed) : null,
                    'private' => $project->visibility === ProjectVisibility::Private ?: null,
                    'archived' => $project->isArchived() ?: null,
                ], fn (mixed $value) => $value !== null);
            })->values()->all(),
        ]);
    }
}
