<?php

namespace App\Mcp\Tools;

use App\Actions\Organizations\RemoveOrganizationMember;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[IsDestructive]
class RemoveMemberTool extends TimetrackerTool
{
    protected string $name = 'remove_member';

    protected string $description = 'Remove a member from the organization (owners and admins only). Destructive: always confirm with the user first. Deactivating (update_member with active=false) is usually better: it removes access but keeps the person in member lists and filters. The owner cannot be removed.';

    public function __construct(private readonly Lookup $lookup)
    {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'member' => $schema->string()->description('Member id, email or name (see list_members).')->required(),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, RemoveOrganizationMember $removeMember): ResponseFactory
    {
        $request->validate(['member' => ['required']]);

        $context = McpContext::from($request);
        Gate::forUser($context->user)->authorize('removeMember', $context->organization);

        $member = $this->lookup->anyMember($context, $request->get('member'));
        $removeMember->handle($member, $context->organization);

        return Response::structured(['removed' => ['id' => $member->id, 'name' => $member->name, 'email' => $member->email]]);
    }
}
