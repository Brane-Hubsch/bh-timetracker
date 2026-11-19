<?php

namespace App\Mcp\Tools;

use App\Actions\Organizations\CreateOrganizationInvitation;
use App\Enums\OrganizationRole;
use App\Mcp\Support\McpContext;
use App\Rules\UniqueOrganizationInvitation;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Gate;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

class InviteMemberTool extends TimetrackerTool
{
    protected string $name = 'invite_member';

    protected string $description = 'Invite someone to the organization by email (owners and admins only). They get an email with a link that is valid for 3 days. Confirm the email address and role with the user first.';

    public function schema(JsonSchema $schema): array
    {
        return [
            'email' => $schema->string()->description('Email address to invite.')->required(),
            'role' => $schema->string()->enum(['member', 'admin'])->description('Role in the organization. Default "member". Ownership cannot be granted.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(Request $request, CreateOrganizationInvitation $createInvitation): ResponseFactory
    {
        $context = McpContext::from($request);
        Gate::forUser($context->user)->authorize('inviteMember', $context->organization);

        $request->validate([
            'email' => ['required', 'string', 'email', 'max:255', new UniqueOrganizationInvitation($context->organization)],
            'role' => ['nullable', 'string', 'in:member,admin'],
        ]);

        $invitation = $createInvitation->handle(
            $context->organization,
            $context->user,
            $this->stringArgument($request, 'email') ?? '',
            OrganizationRole::tryFrom($this->stringArgument($request, 'role') ?? '') ?? OrganizationRole::Member,
        );

        return Response::structured(['invited' => [
            'email' => $invitation->email,
            'role' => $invitation->role->value,
            'expires_at' => $invitation->expires_at?->setTimezone($context->timezone())->format('Y-m-d H:i'),
        ]]);
    }
}
