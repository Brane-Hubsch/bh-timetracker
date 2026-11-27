<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Vite;

class PwaManifestController
{
    public function __invoke(): JsonResponse
    {
        $icons = [];

        foreach (['any' => 'icon', 'maskable' => 'icon-maskable'] as $purpose => $name) {
            foreach ([192, 512] as $size) {
                $icons[] = [
                    'src' => Vite::asset("resources/app-icons/{$name}-{$size}.png"),
                    'sizes' => "{$size}x{$size}",
                    'type' => 'image/png',
                    'purpose' => $purpose,
                ];
            }
        }

        return response()->json([
            'name' => config('app.name'),
            'short_name' => config('app.name'),
            'description' => 'Tidrapportering för team',
            'lang' => 'sv',
            'start_url' => '/',
            'scope' => '/',
            'display' => 'standalone',
            'background_color' => '#ffffff',
            'theme_color' => '#7c3aed',
            'icons' => $icons,
        ], headers: [
            'Content-Type' => 'application/manifest+json',
            'Cache-Control' => 'no-store',
        ]);
    }
}
