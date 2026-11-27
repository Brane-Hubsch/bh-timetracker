{{--
    Full-screen splash shown while the app starts cold: a reload, or a fresh page load that did not
    come from inside the app (a PWA launch after the OS dropped it from memory, a bookmark or a typed
    URL). Full-page loads from within the app and back/forward skip it. It stays at least 1.5 s and
    hides once React has rendered (AppProviders calls window.hideSplash), or after 10 s if the app
    never starts.
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
        background-color: #f9f6ff;
        transition:
            opacity 250ms ease-out,
            visibility 0s linear 250ms;
    }

    html.dark.splash #splash {
        background-color: #18141f;
    }

    html.splash-hiding #splash {
        opacity: 0;
        visibility: hidden;
    }

    /* "Sekundvisaren": the hand ticks round the clock like a second hand. The outer group steps 30°
       at a time (12 steps over 3 s) and the inner group springs each step over 250 ms, so the two
       durations must stay in sync. There is no intro, so the fade-out can start on any frame. */
    #splash .splash-tick,
    #splash .splash-kick {
        transform-box: view-box;
        transform-origin: 64px 74px;
    }

    #splash .splash-tick {
        animation: splash-tick 3s steps(12) infinite;
    }

    #splash .splash-kick {
        animation: splash-kick 250ms infinite;
    }

    @keyframes splash-tick {
        to {
            transform: rotate(360deg);
        }
    }

    @keyframes splash-kick {
        from {
            transform: rotate(-30deg);
            animation-timing-function: cubic-bezier(0.3, 1.6, 0.5, 1);
        }

        55%,
        to {
            transform: rotate(0deg);
        }
    }

    @keyframes splash-pulse {
        50% {
            opacity: 0.6;
        }
    }

    /* A still logo that pulses gently. The !important beats app.css, which shortens every animation
       to 1 ms under reduced motion and would make the infinite ones flicker. */
    @media (prefers-reduced-motion: reduce) {
        #splash {
            transition: none !important;
        }

        #splash .splash-logo * {
            animation: none !important;
        }

        #splash .splash-logo {
            animation: splash-pulse 2s ease-in-out infinite !important;
        }
    }
</style>

<script>
    (function () {
        var minimumVisibleMs = 1500;
        var root = document.documentElement;
        var navigation = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
        var navigationType = navigation ? navigation.type : 'navigate';
        var cameFromApp = false;

        try {
            cameFromApp = document.referrer !== '' && new URL(document.referrer).origin === location.origin;
        } catch (error) {}

        // A reload keeps the original referrer, so only fresh loads are checked for coming from the app.
        var isColdStart = navigationType === 'reload' || (navigationType === 'navigate' && !cameFromApp);

        window.hideSplash = function () {};

        if (!isColdStart) {
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
    <svg class="splash-logo" viewBox="0 0 128 128" width="88" height="88" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="128" height="128" rx="28" fill="#7C3AED" />
        {{-- Strokes are a little thinner than the favicon's 15. The stem's round cap forms the bend, and
             the hand starts one half stroke from the pivot so its square cap meets it while it turns. --}}
        <g stroke="white" stroke-width="13">
            <path class="splash-bar" d="M32 38H96" stroke-linecap="square" />
            <path class="splash-stem" d="M64 38V74" stroke-linecap="round" />
            <g class="splash-tick">
                <g class="splash-kick">
                    <path class="splash-hand" d="M68.99 78.16 88 94" stroke-linecap="square" />
                </g>
            </g>
        </g>
    </svg>
</div>
