<?php

namespace App\Http\Requests\Images;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

/**
 * An uploaded profile picture or logo in the `image` field.
 */
class ImageUploadRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return ['image' => ['required', ...self::imageRules()]];
    }

    /**
     * Raster images only (no SVG, which can carry scripts), within the size and pixel limits in
     * config/images.php.
     *
     * @return array<int, string>
     */
    public static function imageRules(): array
    {
        $maxPixels = config()->integer('images.max_pixels', 6000);

        return [
            'file',
            'image',
            'mimes:jpg,jpeg,png,webp,gif',
            'max:'.config()->integer('images.max_kilobytes', 5120),
            "dimensions:min_width=16,min_height=16,max_width={$maxPixels},max_height={$maxPixels}",
        ];
    }

    public function uploadedImage(): UploadedFile
    {
        $file = $this->file('image');

        abort_unless($file instanceof UploadedFile, 422);

        return $file;
    }
}
