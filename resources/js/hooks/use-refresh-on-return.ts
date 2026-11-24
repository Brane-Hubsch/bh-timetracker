import { router } from '@inertiajs/react';
import { useEffect } from 'react';

/** How long the user must have been away before the page is refreshed. */
const AWAY_MS = 30_000;

/**
 * Reload the current page's data when the user comes back to the app (the tab becomes visible or
 * the window gets focus) after being away for a while, so time reported elsewhere (another device,
 * an AI assistant) shows up without a manual refresh. The reload keeps the page's state and scroll
 * position, shows no progress bar, and also drops prefetched pages, which may be just as old.
 */
export function useRefreshOnReturn(): void {
    useEffect(() => {
        let awaySince: number | null =
            document.visibilityState === 'hidden' ? Date.now() : null;

        const leave = () => {
            awaySince ??= Date.now();
        };

        const comeBack = () => {
            if (document.visibilityState === 'hidden') {
                return;
            }

            const wasAway =
                awaySince !== null && Date.now() - awaySince >= AWAY_MS;
            awaySince = null;

            if (!wasAway || !navigator.onLine) {
                return;
            }

            router.flushAll();
            router.reload({ async: true });
        };

        const onVisibilityChange = () =>
            document.visibilityState === 'hidden' ? leave() : comeBack();

        const listeners = new AbortController();
        const { signal } = listeners;
        document.addEventListener('visibilitychange', onVisibilityChange, {
            signal,
        });
        window.addEventListener('blur', leave, { signal });
        window.addEventListener('focus', comeBack, { signal });

        return () => listeners.abort();
    }, []);
}
