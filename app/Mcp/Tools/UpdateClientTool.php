<?php

namespace App\Mcp\Tools;

use App\Actions\Clients\UpdateClient;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

class UpdateClientTool extends TimetrackerTool
{
    /** Optional fields that can be cleared with null. */
    private const array NULLABLE = ['organization_number', 'email', 'notes'];

    protected string $name = 'update_client';

    protected string $description = 'Change a client (owners and admins only). Only the given fields change; send null to clear an optional field.';

    public function __construct(private readonly Lookup $lookup)
    {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'client' => $schema->string()->description('Client id or name (see list_clients).')->required(),
            'name' => $schema->string()->description('New name.'),
            'organization_number' => $schema->string()->description('Company registration number (org.nr).'),
            'email' => $schema->string()->description('Contact or invoice email.'),
            'notes' => $schema->string()->description('Free-form notes.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, UpdateClient $updateClient): ResponseFactory
    {
        $request->validate([
            'client' => ['required'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'organization_number' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $context = McpContext::from($request);
        $client = $this->lookup->client($context, $request->get('client'));
        Gate::forUser($context->user)->authorize('update', $client);

        $attributes = [];

        if ($this->provided($request, 'name')) {
            $attributes['name'] = $this->stringArgument($request, 'name') ?? '';
        }

        foreach (self::NULLABLE as $field) {
            if ($this->provided($request, $field)) {
                $attributes[$field] = $this->stringArgument($request, $field);
            }
        }

        if ($attributes === []) {
            throw ValidationException::withMessages(['client' => 'Give at least one field to change.']);
        }

        $client = $updateClient->handle($client, $attributes);

        return Response::structured(['updated' => [
            'id' => $client->id,
            'name' => $client->name,
            'organization_number' => $client->organization_number,
            'email' => $client->email,
            'notes' => $client->notes,
            'archived' => $client->archived_at !== null,
        ]]);
    }
}
