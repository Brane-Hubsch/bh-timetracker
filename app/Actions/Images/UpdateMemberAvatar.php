<?php

namespace App\Actions\Images;

use App\Enums\ImageKind;
use App\Models\Membership;
use Illuminate\Http\UploadedFile;

class UpdateMemberAvatar
{
    use ReplacesImage;

    public function handle(Membership $membership, ?UploadedFile $file): void
    {
        $this->replaceImage($membership, 'avatar_path', $file, ImageKind::Avatar);
    }
}
