<?php

namespace App\Mcp\Tools;

use App\Actions\Projects\SetProjectArchived;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

class ArchiveProjectTool extends TimetrackerTool
{
    protected string $name = 'archive_project';

    protected string $description = 'Archive a project, or restore it with archived=false (owners and admins only). Archived projects are hidden when reporting time but stay in reports.';

    public function __construct(private readonly Lookup $lookup)
    {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'project' => $schema->string()->description('Project id or name (see list_projects with include_archived).')->required(),
            'archived' => $schema->boolean()->description('true archives (default), false restores.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, SetProjectArchived $setArchived): ResponseFactory
    {
        $request->validate([
            'project' => ['required'],
            'archived' => ['nullable', 'boolean'],
        ]);

        $context = McpContext::from($request);
        $project = $this->lookup->project($context, $request->get('project'));
        Gate::forUser($context->user)->authorize('update', $project);

        $project = $setArchived->handle($project, $this->boolArgument($request, 'archived') ?? true);

        return Response::structured([
            $project->archived_at !== null ? 'archived' : 'restored' => ['id' => $project->id, 'name' => $project->name],
        ]);
    }
}
