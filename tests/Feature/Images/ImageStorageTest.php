<?php

use App\Enums\ImageKind;
use App\Services\Images\ImageStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    $this->images = app(ImageStorage::class);
});

/**
 * @return array{0: int, 1: int}
 */
function storedSize(string $path): array
{
    $info = getimagesizefromstring((string) Storage::disk('public')->get($path));

    return [$info[0], $info[1]];
}

it('stores profile pictures as square WebP images in every size', function () {
    $directory = $this->images->store(UploadedFile::fake()->image('me.jpg', 900, 600), ImageKind::Avatar);

    expect($directory)->toStartWith('images/avatars/');

    foreach ([64, 128, 256, 512] as $size) {
        Storage::disk('public')->assertExists("{$directory}/{$size}.webp");
        expect(storedSize("{$directory}/{$size}.webp"))->toBe([$size, $size])
            ->and(Storage::disk('public')->mimeType("{$directory}/{$size}.webp"))->toBe('image/webp');
    }
});

it('scales logos to fit without cropping or enlarging them', function () {
    $directory = $this->images->store(UploadedFile::fake()->image('logo.png', 400, 100), ImageKind::Logo);

    expect(storedSize("{$directory}/64.webp"))->toBe([64, 16])
        ->and(storedSize("{$directory}/256.webp"))->toBe([256, 64])
        // Never enlarged beyond the original.
        ->and(storedSize("{$directory}/512.webp"))->toBe([400, 100]);
});

it('hands out the URL of the closest size and deletes all sizes', function () {
    $directory = $this->images->store(UploadedFile::fake()->image('logo.png', 300, 300), ImageKind::Logo);

    expect($this->images->url($directory, 100))->toEndWith("{$directory}/128.webp")
        ->and($this->images->url($directory, 2000))->toEndWith("{$directory}/512.webp")
        ->and($this->images->url(null))->toBeNull()
        ->and($this->images->dataUri($directory))->toStartWith('data:image/png;base64,');

    $this->images->delete($directory);

    Storage::disk('public')->assertMissing("{$directory}/128.webp");
});

it('only deletes directories it created', function () {
    Storage::disk('public')->put('other/file.txt', 'keep');

    $this->images->delete('other');

    Storage::disk('public')->assertExists('other/file.txt');
});
