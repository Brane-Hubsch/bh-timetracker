<?php

namespace App\Actions\Images;

use App\Enums\ImageKind;
use App\Models\Organization;
use Illuminate\Http\UploadedFile;

class UpdateOrganizationLogo
{
    use ReplacesImage;

    /**
     * Set or remove (null) the organization's logo, shown in the organization switcher and on PDF reports.
     */
    public function handle(Organization $organization, ?UploadedFile $file): Organization
    {
        $this->replaceImage($organization, 'logo_path', $file, ImageKind::Logo);

        return $organization;
    }
}
