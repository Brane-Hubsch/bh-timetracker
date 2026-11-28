@php
    $theme = $page['props']['theme'] ?? [];
    $palette = \App\Enums\Theme::tryFrom($theme['theme'] ?? '') ?? \App\Enums\Theme::Standard;
    $alwaysDark = $palette->isAlwaysDark();
    $accent = $theme['accent'] ?? 'violet';
    $customAccent = preg_match('/\A#[0-9a-f]{6}\z/', $accent) === 1 ? $accent : null;
@endphp
<!DOCTYPE html>
<html
    lang="{{ str_replace('_', '-', app()->getLocale()) }}"
    @class(['dark' => ($appearance ?? 'system') == 'dark' || $alwaysDark])
    @if ($alwaysDark) data-forced-mode="dark" @endif
    data-palette="{{ $theme['theme'] ?? 'standard' }}"
    data-accent="{{ $accent }}"
    @if ($customAccent) style="--custom-accent: {{ $customAccent }}" @endif
    data-contrast="{{ ($theme['contrast'] ?? 'system') === 'more' ? 'more' : 'normal' }}"
>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="theme-color" content="{{ in_array($palette, [\App\Enums\Theme::Terminal, \App\Enums\Theme::Barbie], true) ? '#7c3aed' : ($customAccent ?? '#7c3aed') }}">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="default">
        <meta name="apple-mobile-web-app-title" content="{{ config('app.name') }}">

        {{-- Apply browser and installed-app settings before rendering. --}}
        <script>
            (function() {
                const { userAgent, maxTouchPoints } = window.navigator;
                const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                    || window.navigator.standalone === true;

                const isIOS = /iPhone|iPad|iPod/i.test(userAgent)
                    || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);

                if (isIOS && !isStandalone) {
                    document.documentElement.dataset.iosBrowser = '';
                }

                if (!isStandalone && /Android/i.test(userAgent)) {
                    // Retain the event even if it arrives before the app shell loads.
                    window.addEventListener('beforeinstallprompt', (event) => {
                        event.preventDefault();
                        window.pwaInstallPrompt = event;
                    });
                    window.addEventListener('appinstalled', () => {
                        window.pwaInstallPrompt = undefined;
                    });
                }

                if (isStandalone) {
                    const viewport = document.querySelector('meta[name="viewport"]');
                    viewport.content += ', maximum-scale=1, user-scalable=no';

                    // A blocked pinch should not be treated as a tap on a control.
                    document.addEventListener('touchstart', (event) => {
                        if (event.touches.length > 1) {
                            event.preventDefault();
                        }
                    }, { capture: true, passive: false });
                }

                if ('{{ $theme['contrast'] ?? 'system' }}' === 'system' && window.matchMedia('(prefers-contrast: more)').matches) {
                    document.documentElement.dataset.contrast = 'more';
                }

                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: oklch(1 0 0);
            }

            html.dark {
                background-color: oklch(0.145 0 0);
            }
        </style>

        <link rel="icon" href="{{ Vite::asset('public/favicon.ico') }}" sizes="16x16 32x32 48x48">
        <link rel="icon" href="{{ Vite::asset('public/favicon.svg') }}" type="image/svg+xml" sizes="any">
        @foreach ([120, 152, 167, 180] as $size)
            <link rel="apple-touch-icon" href="{{ Vite::asset("resources/app-icons/apple-touch-{$size}.png") }}" sizes="{{ $size }}x{{ $size }}">
        @endforeach
        <link rel="manifest" href="{{ route('pwa.manifest', absolute: false) }}">

        @if (app()->isProduction() && filled(config('services.umami.script_url')) && filled(config('services.umami.website_id')) && request()->getHost() === config('services.umami.domain'))
            @include('analytics.umami')
        @endif

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>{{ config('app.name') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        @include('splash')
        <x-inertia::app />
        <div class="mobile-status-bar-tint" aria-hidden="true"></div>
    </body>
</html>
