<?php

namespace App\Services\Images;

use App\Enums\ImageKind;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;
use Intervention\Image\Interfaces\ImageInterface;

/**
 * Stores uploaded images as WebP in a fixed set of sizes (config/images.php) under
 * `images/{kind}/{uuid}/{size}.webp`, and hands out their URLs. Images are read with their EXIF
 * orientation applied, animations are reduced to the first frame and metadata (such as GPS
 * positions) is dropped by re-encoding.
 */
class ImageStorage
{
    private readonly ImageManager $manager;

    public function __construct()
    {
        $this->manager = new ImageManager(new Driver);
    }

    /**
     * Process and store an upload; returns the directory to save on the model.
     */
    public function store(UploadedFile $file, ImageKind $kind): string
    {
        $image = $this->manager->read($file->getRealPath());
        $image->removeAnimation();

        $sizes = $this->sizes();
        rsort($sizes);

        // Work down from the largest size, so large photos are only decoded at full size once.
        $image = $this->resize($image, $kind, $sizes[0]);
        $directory = 'images/'.$kind->directory().'/'.Str::uuid();

        foreach ($sizes as $size) {
            $image = $this->resize($image, $kind, $size);
            $this->disk()->put(
                "{$directory}/{$size}.webp",
                $image->toWebp(quality: config()->integer('images.quality', 85))->toString(),
                ['visibility' => 'public'],
            );
        }

        return $directory;
    }

    /**
     * Public URL of the stored size closest to (and at least) the requested one.
     */
    public function url(?string $directory, int $size = 128): ?string
    {
        return $directory === null ? null : $this->disk()->url($this->file($directory, $size));
    }

    /**
     * A PNG data URI, for documents that can't load WebP or remote files (PDF exports).
     */
    public function dataUri(?string $directory, int $size = 256, bool $square = false): ?string
    {
        if ($directory === null) {
            return null;
        }

        $contents = $this->disk()->get($this->file($directory, $size));

        if ($contents === null) {
            return null;
        }

        $image = $this->manager->read($contents);

        // Organization logos uploaded before square cropping was introduced can be rectangular.
        if ($square && $image->width() !== $image->height()) {
            $side = min($image->width(), $image->height());
            $image = $image->cover($side, $side);
        }

        return 'data:image/png;base64,'.base64_encode($image->toPng()->toString());
    }

    public function delete(?string $directory): void
    {
        if ($directory !== null && str_starts_with($directory, 'images/')) {
            $this->disk()->deleteDirectory($directory);
        }
    }

    public function disk(): Filesystem
    {
        return Storage::disk(config()->string('images.disk', 'public'));
    }

    /**
     * @return array<int, int>
     */
    private function sizes(): array
    {
        $sizes = array_filter(
            array_map(fn (mixed $size) => is_numeric($size) ? (int) $size : null, config()->array('images.sizes', [64, 128, 256, 512])),
            fn (?int $size) => $size !== null && $size > 0,
        );

        return $sizes === [] ? [128] : array_values($sizes);
    }

    private function file(string $directory, int $size): string
    {
        $sizes = $this->sizes();
        sort($sizes);
        $chosen = array_find($sizes, fn (int $candidate) => $candidate >= $size) ?? end($sizes);

        return "{$directory}/{$chosen}.webp";
    }

    private function resize(ImageInterface $image, ImageKind $kind, int $size): ImageInterface
    {
        return $kind->crops()
            ? $image->cover($size, $size)
            : $image->scaleDown($size, $size);
    }
}
