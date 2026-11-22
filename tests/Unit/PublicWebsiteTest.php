<?php

use App\Services\Images\PublicWebsite;
use GuzzleHttp\Psr7\Uri;

it('rejects unsupported network destinations', function (string $url) {
    expect((new PublicWebsite)->get(new Uri($url), 1024, microtime(true) + 1))->toBeNull();
})->with([
    'file:///etc/hosts',
    'http://localhost',
    'http://127.0.0.1',
    'http://127.1',
    'http://[::1]',
    'https://example.com:8080',
    'https://user:password@example.com',
]);
