<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Services\Images\ImageStorage;
use Illuminate\Validation\ValidationException;

class DeleteAccount
{
    public function __construct(private readonly ImageStorage $images)
    {
        //
    }

    /**
     * Delete the user's account. Owners must delete their organizations first, so an organization
     * never loses its owner. Memberships, passkeys and links are removed by foreign key cascades,
     * and the uploaded profile picture is deleted.
     *
     * @throws ValidationException
     */
    public function handle(User $user): void
    {
        $this->ensureDeletable($user);

        $user->delete();
        $this->images->delete($user->avatar_path);
    }

    /**
     * Check before logging the user out, so a refused deletion keeps them signed in.
     *
     * @throws ValidationException
     */
    public function ensureDeletable(User $user): void
    {
        if ($user->ownedOrganizations()->exists()) {
            throw ValidationException::withMessages([
                'email' => __('You own an organization. Delete it before deleting your account.'),
            ]);
        }
    }
}
