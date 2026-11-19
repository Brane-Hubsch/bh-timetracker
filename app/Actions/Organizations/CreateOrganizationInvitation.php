<?php

namespace App\Actions\Organizations;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Notifications\Organizations\OrganizationInvitation as OrganizationInvitationNotification;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Notification;

class CreateOrganizationInvitation
{
    /**
     * Invite an email address to the organization with the given role and send the invitation email.
     *
     * @throws AuthorizationException
     */
    public function handle(Organization $organization, User $inviter, string $email, OrganizationRole $role): OrganizationInvitation
    {
        if ($role === OrganizationRole::Owner) {
            throw new AuthorizationException(__('Ownership cannot be granted through an invitation.'));
        }

        $invitation = $organization->invitations()->create([
            'email' => $email,
            'role' => $role,
            'invited_by' => $inviter->id,
            'expires_at' => now()->addDays(3),
        ]);

        Notification::route('mail', $invitation->email)
            ->notify(new OrganizationInvitationNotification($invitation));

        return $invitation;
    }
}
