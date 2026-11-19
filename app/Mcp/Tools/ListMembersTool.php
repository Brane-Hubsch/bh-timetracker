<?php

namespace App\Mcp\Tools;

use App\Enums\OrganizationPermission;
use App\Mcp\Support\McpContext;
use App\Models\Membership;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class ListMembersTool extends TimetrackerTool
{
    protected string $name = 'list_members';

    protected string $description = 'The organization\'s members (role, active or deactivated) and pending invitations, as on the organization settings page. Hourly rates are only shown to owners and admins; null means the organization default rate applies.';

    public function schema(JsonSchema $schema): array
    {
        return ['organization' => $this->organizationArgument($schema)];
    }

    public function handle(Request $request): ResponseFactory
    {
        $context = McpContext::from($request);
        $showRates = $context->can(OrganizationPermission::ViewRates);

        $members = $context->organization->members()->orderBy('name')->get()->map(function (User $member) use ($showRates) {
            /** @var Membership $membership */
            $membership = $member->getRelation('pivot');

            return array_filter([
                'id' => $member->id,
                'name' => $member->name,
                'email' => $member->email,
                'role' => $membership->role->value,
                'active' => ! $membership->isDeactivated(),
                'hourly_rate' => $showRates ? $this->money($membership->hourly_rate) : null,
            ], fn (mixed $value) => $value !== null);
        });

        $invitations = $context->organization->invitations()
            ->whereNull('accepted_at')
            ->orderBy('email')
            ->get()
            ->map(fn (OrganizationInvitation $invitation) => [
                'email' => $invitation->email,
                'role' => $invitation->role->value,
                'expires_at' => $invitation->expires_at?->setTimezone($context->timezone())->format('Y-m-d H:i'),
                'expired' => $invitation->isExpired(),
            ]);

        return Response::structured([
            'organization' => $context->organization->slug,
            'currency' => $showRates ? $context->organization->currency : null,
            'members' => $members->values()->all(),
            'pending_invitations' => $invitations->values()->all(),
        ]);
    }
}
