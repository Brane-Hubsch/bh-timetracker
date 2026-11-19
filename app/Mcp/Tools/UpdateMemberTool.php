<?php

namespace App\Mcp\Tools;

use App\Actions\Organizations\SetOrganizationMemberActive;
use App\Actions\Organizations\UpdateOrganizationMemberRate;
use App\Actions\Organizations\UpdateOrganizationMemberRole;
use App\Enums\OrganizationPermission;
use App\Enums\OrganizationRole;
use App\Mcp\Support\Lookup;
use App\Mcp\Support\McpContext;
use App\Models\Membership;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

class UpdateMemberTool extends TimetrackerTool
{
    protected string $name = 'update_member';

    protected string $description = 'Change a member\'s role, default hourly rate or active status (owners and admins only). Only the given fields change. Deactivated members lose access but keep their time history. The owner\'s role cannot be changed and the owner cannot be deactivated.';

    public function __construct(private readonly Lookup $lookup)
    {
        //
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'member' => $schema->string()->description('Member id, email or name (see list_members).')->required(),
            'role' => $schema->string()->enum(['member', 'admin'])->description('New role.'),
            'hourly_rate' => $schema->number()->description('Default hourly rate in the organization currency (e.g. 950). Send null to use the organization default.'),
            'active' => $schema->boolean()->description('false deactivates the member, true reactivates them.'),
            'organization' => $this->organizationArgument($schema),
        ];
    }

    public function handle(
        Request $request,
        UpdateOrganizationMemberRole $updateRole,
        UpdateOrganizationMemberRate $updateRate,
        SetOrganizationMemberActive $setActive,
    ): ResponseFactory {
        $request->validate([
            'member' => ['required'],
            'role' => ['nullable', 'string', 'in:member,admin'],
            'hourly_rate' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'active' => ['nullable', 'boolean'],
        ]);

        $context = McpContext::from($request);
        $gate = Gate::forUser($context->user);
        $gate->authorize('updateMember', $context->organization);

        $changesRate = $this->provided($request, 'hourly_rate');

        if ($changesRate) {
            $gate->authorize('viewRates', $context->organization);
        }

        $role = OrganizationRole::tryFrom($this->stringArgument($request, 'role') ?? '');
        $active = $this->boolArgument($request, 'active');

        if ($role === null && ! $changesRate && $active === null) {
            throw ValidationException::withMessages(['member' => 'Give at least one of role, hourly_rate or active to change.']);
        }

        $member = $this->lookup->anyMember($context, $request->get('member'));
        $hourlyRate = $request->get('hourly_rate');

        DB::transaction(function () use ($context, $member, $role, $changesRate, $hourlyRate, $active, $updateRole, $updateRate, $setActive) {
            if ($role !== null) {
                $updateRole->handle($context->organization, $member, $role);
            }

            if ($changesRate) {
                $updateRate->handle($context->organization, $member, is_numeric($hourlyRate) ? (int) round((float) $hourlyRate * 100) : null);
            }

            if ($active !== null) {
                $setActive->handle($context->organization, $member, $active);
            }
        });

        /** @var Membership $membership */
        $membership = $context->organization->memberships()->where('user_id', $member->id)->firstOrFail();

        return Response::structured(['updated' => [
            'id' => $member->id,
            'name' => $member->name,
            'role' => $membership->role->value,
            'active' => ! $membership->isDeactivated(),
            'hourly_rate' => $context->can(OrganizationPermission::ViewRates) ? $this->money($membership->hourly_rate) : null,
        ]]);
    }
}
