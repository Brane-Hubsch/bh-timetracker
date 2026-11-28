import { lazy, Suspense, useEffect, useState } from 'react';
import { Fireworks } from '@/components/seasonal/fireworks';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
    seasonalEffectsOn,
    useSeasonalEffectsEnabled,
} from '@/lib/seasonal-effects';
import type { SeasonalEffects as Effects } from '@/lib/seasonal-effects';

// The snow (WebGPU, a worker, the snowman game) is a chunk of its own, fetched when the page is idle.
const SnowScene = lazy(() => import('@/components/seasonal/snow-scene'));

/** Re-check the date every hour, so the effects start and stop around midnight. */
function useSeason(): Effects {
    const [season, setSeason] = useState(() => seasonalEffectsOn(new Date()));

    useEffect(() => {
        const timer = window.setInterval(
            () => setSeason(seasonalEffectsOn(new Date())),
            60 * 60 * 1000,
        );

        return () => window.clearInterval(timer);
    }, []);

    return season;
}

/** True once the page has loaded and the browser has had a quiet moment. */
function usePageIdle(wanted: boolean): boolean {
    const [idle, setIdle] = useState(false);

    useEffect(() => {
        if (!wanted || idle) {
            return;
        }
        let handle = 0;
        const whenIdle = () => {
            if (typeof window.requestIdleCallback === 'function') {
                handle = window.requestIdleCallback(() => setIdle(true), {
                    timeout: 4000,
                });
            } else {
                handle = window.setTimeout(() => setIdle(true), 1200);
            }
        };
        if (document.readyState === 'complete') {
            whenIdle();
        } else {
            window.addEventListener('load', whenIdle, { once: true });
        }

        return () => {
            window.removeEventListener('load', whenIdle);
            if (typeof window.cancelIdleCallback === 'function') {
                window.cancelIdleCallback(handle);
            }
            window.clearTimeout(handle);
        };
    }, [wanted, idle]);

    return idle;
}

/**
 * Decorative snow in December and fireworks around New Year, behind dialogs. They never get in the way
 * of clicks, pause while the tab is hidden and are not shown when the device asks for reduced motion.
 * The snow never delays the page: it is loaded afterwards and fades in when it is ready.
 */
export function SeasonalEffects() {
    const enabled = useSeasonalEffectsEnabled();
    const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
    const { snow, fireworks } = useSeason();
    const active = enabled && !reducedMotion;
    const snowReady = usePageIdle(active && snow);

    if (!active) {
        return null;
    }

    return (
        <>
            {snow && snowReady && (
                <Suspense fallback={null}>
                    <SnowScene />
                </Suspense>
            )}
            {fireworks && <Fireworks />}
        </>
    );
}
