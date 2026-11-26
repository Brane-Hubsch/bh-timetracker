{{--
    Full-screen splash shown while the app starts cold: a fresh page load that did not come from
    inside the app (a PWA launch after the OS dropped it from memory, a bookmark or a typed URL).
    Reloads and full-page loads from within the app skip it. It stays at least 1.5 s and hides once
    React has rendered (AppProviders calls window.hideSplash), or after 10 s if the app never starts.
    Everything is inline so it paints before the JS bundle has loaded.
--}}
<style>
    #splash {
        display: none;
    }

    html.splash {
        overflow: hidden;
    }

    html.splash #splash {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: oklch(1 0 0);
        transition:
            opacity 250ms ease-out,
            visibility 0s linear 250ms;
    }

    html.dark.splash #splash {
        background-color: oklch(0.145 0 0);
    }

    html.splash-hiding #splash {
        opacity: 0;
        visibility: hidden;
    }

    #splash svg {
        width: 88px;
        height: 88px;
        animation: splash-enter 400ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }

    #splash .splash-hand {
        transform-box: view-box;
        transform-origin: 64px 74px;
        animation: splash-sweep 1500ms cubic-bezier(0.65, 0, 0.35, 1) 200ms infinite;
    }

    @keyframes splash-enter {
        from {
            opacity: 0;
            transform: scale(0.92);
        }
    }

    @keyframes splash-sweep {
        to {
            transform: rotate(360deg);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        #splash,
        #splash * {
            animation: none !important;
            transition: none !important;
        }
    }
</style>

<script>
    (function () {
        var minimumVisibleMs = 1500;
        var root = document.documentElement;
        var navigation = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
        var isFreshLoad = !navigation || navigation.type === 'navigate';
        var cameFromApp = false;

        try {
            cameFromApp = document.referrer !== '' && new URL(document.referrer).origin === location.origin;
        } catch (error) {}

        window.hideSplash = function () {};

        if (!isFreshLoad || cameFromApp) {
            return;
        }

        var shownAt = performance.now();
        var hiding = false;

        root.classList.add('splash');

        // Count the minimum from the first painted frame, which waits for render-blocking CSS and fonts.
        requestAnimationFrame(function () {
            shownAt = performance.now();
        });

        window.hideSplash = function () {
            if (hiding) {
                return;
            }

            hiding = true;

            setTimeout(function () {
                root.classList.add('splash-hiding');

                setTimeout(function () {
                    root.classList.remove('splash', 'splash-hiding');
                    document.getElementById('splash')?.remove();
                }, 300);
            }, Math.max(0, minimumVisibleMs - (performance.now() - shownAt)));
        };

        setTimeout(window.hideSplash, 10000);
    })();
</script>

<div id="splash" role="status" aria-label="{{ __('Loading…') }}">
    <svg viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="128" height="128" rx="28" fill="#7C3AED" />
        <g stroke="white" stroke-width="15">
            <path class="splash-bar" d="M32 38H96" stroke-linecap="square" />
            <path class="splash-stem" d="M64 38V74" />
            <circle class="splash-pivot" cx="64" cy="74" r="7.5" fill="white" stroke="none" />
            {{-- The hand ends where the logo's square cap would, so it can rotate around the pivot. --}}
            <path class="splash-hand" d="M64 74L93.76 98.8" />
        </g>
    </svg>
</div>
