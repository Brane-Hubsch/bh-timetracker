<?php

namespace App\Actions\Auth;

use App\Actions\Organizations\AcceptOrganizationInvitation;
use App\Exceptions\SignInNotAllowedException;
use App\Models\OrganizationInvitation;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CreateUserFromInvitation
{
    public function __construct(private readonly AcceptOrganizationInvitation $acceptInvitation)
    {
        //
    }

    /**
     * Create a passwordless account for the invited email address and accept the invitation. The
     * invitation link was emailed, so following it proves access to the address (verified).
     *
     * @throws SignInNotAllowedException
     */
    public function handle(OrganizationInvitation $invitation, string $name): User
    {
        if (! $invitation->isPending()) {
            throw new SignInNotAllowedException(__('This invitation has expired.'));
        }

        $email = mb_strtolower(trim($invitation->email));

        if (User::query()->whereRaw('LOWER(email) = ?', [$email])->exists()) {
            throw new SignInNotAllowedException(__('There is already an account for :email. Sign in to accept the invitation.', [
                'email' => $email,
            ]));
        }

        return DB::transaction(function () use ($invitation, $name, $email) {
            $user = User::create([
                'name' => trim($name),
                'email' => $email,
            ]);

            $user->forceFill(['email_verified_at' => now()])->save();

            $this->acceptInvitation->handle($user, $invitation);

            return $user;
        });
    }
}
