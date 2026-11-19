<?php

namespace App\Mcp\Tools;

use App\Actions\Organizations\CancelOrganizationInvitation;
use App\Mcp\Support\McpContext;
use App\Models\OrganizationInvitation;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[IsDestructive]
class CancelInvitationTool extends TimetrackerTool
{
    protected string $name = 'cancel_invitation';

    protected string $description = 'Cancel a pending invitation (owners and admins only), so its link stops working. Find it with list_members.';

    public function schema(JsonSchema $schema): array
    {
        return [
            'email' => $schema->string()->description('Email address of the pending invitation.')->required(),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, CancelOrganizationInvitation $cancelInvitation): ResponseFactory
    {
        $request->validate(['email' => ['required', 'string', 'max:255']]);

        $context = McpContext::from($request);
        Gate::forUser($context->user)->authorize('cancelInvitation', $context->organization);

        $email = mb_strtolower($this->stringArgument($request, 'email') ?? '');
        $invitation = $context->organization->invitations()
            ->whereNull('accepted_at')
            ->get()
            ->first(fn (OrganizationInvitation $invitation) => mb_strtolower($invitation->email) === $email)
            ?? throw ValidationException::withMessages(['email' => "No pending invitation for {$email}."]);

        $cancelInvitation->handle($invitation);

        return Response::structured(['cancelled' => ['email' => $invitation->email]]);
    }
}
