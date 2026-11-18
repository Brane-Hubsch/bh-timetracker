<?php

namespace App\Mcp\Tools;

use App\Enums\OrganizationPermission;
use App\Mcp\Support\McpContext;
use App\Models\Client;
use App\Models\Project;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class ListClientsTool extends TimetrackerTool
{
    protected string $name = 'list_clients';

    protected string $description = 'Search or list clients. Owners and admins see all clients with details; members only see clients of projects they can access.';

    public function schema(JsonSchema $schema): array
    {
        return [
            'search' => $schema->string()->description('Part of the client name or organization number.'),
            'include_archived' => $schema->boolean()->description('Include archived clients. Default false.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request): ResponseFactory
    {
        $request->validate(['search' => ['nullable', 'string', 'max:255'], 'include_archived' => ['nullable', 'boolean']]);
        $context = McpContext::from($request);
        $isManager = $context->can(OrganizationPermission::ManageClients);
        $search = $this->stringArgument($request, 'search');

        $clients = Client::query()
            ->when(! $isManager, fn (Builder $query) => $query->whereIn(
                'id',
                Project::query()->accessibleBy($context->user, $context->organization)->whereNotNull('client_id')->select('client_id'),
            ))
            ->when(! $request->get('include_archived'), fn (Builder $query) => $query->whereNull('archived_at'))
            ->when($search !== null, fn (Builder $query) => $query->search($search))
            ->withCount(['projects' => fn (Builder $query) => $query->whereNull('archived_at')])
            ->orderBy('name')
            ->limit(200)
            ->get();

        return Response::structured([
            'clients' => $clients->map(fn (Client $client) => $isManager
                ? array_filter([
                    'id' => $client->id,
                    'name' => $client->name,
                    'organization_number' => $client->organization_number,
                    'email' => $client->email,
                    'active_projects' => $client->getAttribute('projects_count'),
                    'archived' => $client->archived_at !== null ?: null,
                ], fn (mixed $value) => $value !== null)
                : ['id' => $client->id, 'name' => $client->name])
                ->values()
                ->all(),
        ]);
    }
}
