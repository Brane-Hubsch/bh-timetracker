<?php

namespace App\Actions\Images;

use App\Enums\ImageKind;
use App\Models\Client;
use Illuminate\Http\UploadedFile;

class UpdateClientLogo
{
    use ReplacesImage;

    /**
     * Set or remove (null) the client's logo, shown with the client in lists and on PDF reports.
     */
    public function handle(Client $client, ?UploadedFile $file): Client
    {
        $this->replaceImage($client, 'logo_path', $file, ImageKind::Logo);

        return $client;
    }
}
