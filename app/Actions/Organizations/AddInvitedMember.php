<?php

namespace App\Actions\Organizations;

use App\Enums\OrganizationRole;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AddInvitedMember
{
    /**
     * Add an invited person to the organization before they accept, e.g. so imported time can be put
     * on them: create their passwordless account (unless they have one) and a membership with the
     * invitation's role. The invitation stays pending, so they sign in with it as usual; accepting
     * it keeps the membership. Their email is verified when they first sign in.
     *
     * @throws AuthorizationException
     * @throws ValidationException
     */
    public function handle(OrganizationInvitation $invitation, string $name): User
    {
        if ($invitation->role === OrganizationRole::Owner) {
            throw new AuthorizationException(__('Ownership cannot be granted through an invitation.'));
        }

        if (! $invitation->isPending()) {
            throw ValidationException::withMessages(['invitation' => __('This invitation has expired.')]);
        }

        return DB::transaction(function () use ($invitation, $name) {
            $email = mb_strtolower(trim($invitation->email));
            $organization = $invitation->organization;

            $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first()
                ?? User::create(['name' => trim($name) !== '' ? trim($name) : $email, 'email' => $email]);

            $organization->memberships()->firstOrCreate(
                ['user_id' => $user->id],
                ['role' => $invitation->role],
            );

            if ($user->current_organization_id === null) {
                $user->update(['current_organization_id' => $organization->id]);
            }

            return $user;
        });
    }
}
