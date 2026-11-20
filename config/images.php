<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Image Disk
    |--------------------------------------------------------------------------
    |
    | Where uploaded profile pictures and logos are stored. The disk must serve
    | public URLs: "public" locally (run `php artisan storage:link`), or an S3
    | compatible bucket with public reads in production. File names contain a
    | random UUID, so URLs cannot be guessed.
    |
    */

    'disk' => env('IMAGES_DISK', 'public'),

    /*
    |--------------------------------------------------------------------------
    | Uploads
    |--------------------------------------------------------------------------
    |
    | Largest accepted file (kilobytes) and largest width/height in pixels. The
    | pixel limit keeps decoding within the PHP memory limit; a 12 MP phone
    | photo fits.
    |
    */

    'max_kilobytes' => 5120,

    'max_pixels' => 6000,

    /*
    |--------------------------------------------------------------------------
    | Sizes
    |--------------------------------------------------------------------------
    |
    | Every upload is stored as WebP in these sizes (up to the longest side for
    | client logos, both sides for profile pictures and workspace icons). Pick
    | the size closest to twice the display size for high-density screens.
    |
    */

    'sizes' => [64, 128, 256, 512],

    'quality' => 85,

];
