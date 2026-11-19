<?php

namespace App\Mcp\Tools;

use App\Actions\Clients\SetClientArchived;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

class ArchiveClientTool extends TimetrackerTool
{
    protected string $name = 'archive_client';

    protected string $description = 'Archive a client, or restore it with archived=false (owners and admins only). Archived clients and their projects are hidden when reporting time but stay in reports. Projects are not archived along with the client.';

    public function __construct(private readonly Lookup $lookup)
    {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'client' => $schema->string()->description('Client id or name (see list_clients with include_archived).')->required(),
            'archived' => $schema->boolean()->description('true archives (default), false restores.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, SetClientArchived $setArchived): ResponseFactory
    {
        $request->validate([
            'client' => ['required'],
            'archived' => ['nullable', 'boolean'],
        ]);

        $context = McpContext::from($request);
        $client = $this->lookup->client($context, $request->get('client'));
        Gate::forUser($context->user)->authorize('update', $client);

        $client = $setArchived->handle($client, $this->boolArgument($request, 'archived') ?? true);

        return Response::structured([
            $client->archived_at !== null ? 'archived' : 'restored' => ['id' => $client->id, 'name' => $client->name],
        ]);
    }
}
