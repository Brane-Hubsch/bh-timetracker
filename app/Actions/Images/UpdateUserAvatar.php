<?php

namespace App\Actions\Images;

use App\Enums\ImageKind;
use App\Models\User;
use Illuminate\Http\UploadedFile;

class UpdateUserAvatar
{
    use ReplacesImage;

    /**
     * Set or remove (null) the user's uploaded profile picture. Without one, the Google picture or initials are shown.
     */
    public function handle(User $user, ?UploadedFile $file): User
    {
        $this->replaceImage($user, 'avatar_path', $file, ImageKind::Avatar);

        return $user;
    }
}
