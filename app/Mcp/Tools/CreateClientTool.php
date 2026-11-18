<?php

namespace App\Mcp\Tools;

use App\Actions\Clients\CreateClient;
use App\Mcp\Support\McpContext;
use App\Models\Client;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

class CreateClientTool extends TimetrackerTool
{
    protected string $name = 'create_client';

    protected string $description = 'Create a client (owners and admins only). Check with list_clients first that it does not already exist.';

    public function schema(JsonSchema $schema): array
    {
        return [
            'name' => $schema->string()->description('Client name.')->required(),
            'organization_number' => $schema->string()->description('Company registration number (org.nr).'),
            'email' => $schema->string()->description('Contact or invoice email.'),
            'notes' => $schema->string()->description('Free-form notes.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, CreateClient $createClient): ResponseFactory
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'organization_number' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $context = McpContext::from($request);
        Gate::forUser($context->user)->authorize('create', Client::class);

        $client = $createClient->handle($context->organization, [
            'name' => $this->stringArgument($request, 'name') ?? '',
            'organization_number' => $this->stringArgument($request, 'organization_number'),
            'email' => $this->stringArgument($request, 'email'),
            'notes' => $this->stringArgument($request, 'notes'),
        ]);

        return Response::structured(['created' => ['id' => $client->id, 'name' => $client->name]]);
    }
}
