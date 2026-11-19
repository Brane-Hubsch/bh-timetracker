<?php

namespace App\Actions\Images;

use App\Enums\ImageKind;
use App\Services\Images\ImageStorage;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;

/**
 * Replace (or remove) the image stored in one column of a model: the new sizes are stored first,
 * then the column is updated, then the old files are deleted.
 */
trait ReplacesImage
{
    protected function replaceImage(Model $model, string $column, ?UploadedFile $file, ImageKind $kind): void
    {
        $images = app(ImageStorage::class);
        $previous = $model->getAttribute($column);
        $path = $file === null ? null : $images->store($file, $kind);

        try {
            $model->update([$column => $path]);
        } catch (\Throwable $exception) {
            $images->delete($path);

            throw $exception;
        }

        $images->delete(is_string($previous) ? $previous : null);
    }
}
