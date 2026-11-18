<?php

namespace App\Actions\Auth;

use App\Actions\Organizations\AcceptOrganizationInvitation;
use App\Data\GoogleProfile;
use App\Exceptions\SignInNotAllowedException;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Support\SignInOptions;
use Illuminate\Support\Facades\DB;

class AuthenticateWithGoogle
{
    public function __construct(
        private readonly SignInOptions $options,
        private readonly AcceptOrganizationInvitation $acceptInvitation,
    ) {
        //
    }

    /**
     * Find, link or create the user for a Google account.
     *
     * - Only verified Google email addresses are accepted.
     * - An existing account is matched on Google id, then on email (and the Google id is linked).
     * - A new account is only created with open registration or a pending invitation for the email.
     * - The invitation the user came from is accepted when it was sent to the same address.
     *
     * @throws SignInNotAllowedException
     */
    public function handle(GoogleProfile $profile, ?OrganizationInvitation $invitation = null): User
    {
        if (! $profile->emailVerified || $profile->email === '') {
            throw new SignInNotAllowedException(__('Your Google account has no verified email address.'));
        }

        return DB::transaction(function () use ($profile, $invitation) {
            $user = $this->findOrLinkUser($profile) ?? $this->createUser($profile);

            if ($invitation && $invitation->isPending() && mb_strtolower($invitation->email) === mb_strtolower($user->email)) {
                $this->acceptInvitation->handle($user, $invitation);
            }

            return $user;
        });
    }

    private function findOrLinkUser(GoogleProfile $profile): ?User
    {
        $user = User::query()->where('google_id', $profile->id)->first()
            ?? User::query()->whereRaw('LOWER(email) = ?', [$profile->email])->first();

        if (! $user) {
            return null;
        }

        $user->forceFill([
            'google_id' => $profile->id,
            'avatar_url' => $user->avatar_url ?? $profile->avatarUrl,
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        return $user;
    }

    private function createUser(GoogleProfile $profile): User
    {
        $isInvited = OrganizationInvitation::query()->pendingFor($profile->email)->exists();

        if (! $this->options->openRegistration() && ! $isInvited) {
            throw new SignInNotAllowedException(__('There is no account for :email. Ask your organization for an invitation.', [
                'email' => $profile->email,
            ]));
        }

        $user = User::create([
            'name' => $profile->name,
            'email' => $profile->email,
            'google_id' => $profile->id,
            'avatar_url' => $profile->avatarUrl,
        ]);

        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }
}
