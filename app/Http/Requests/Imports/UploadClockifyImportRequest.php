<?php

namespace App\Http\Requests\Imports;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

class UploadClockifyImportRequest extends FormRequest
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'extensions:csv,txt', 'max:5120'],
        ];
    }

    /**
     * The uploaded CSV as text.
     */
    public function csvContents(): string
    {
        $file = $this->file('file');

        return $file instanceof UploadedFile ? (string) $file->get() : '';
    }
}
