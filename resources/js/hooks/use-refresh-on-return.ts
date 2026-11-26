import { router, usePage } from '@inertiajs/react';
import { useEffect, useEffectEvent } from 'react';

/** How long the user must have been away before the page is refreshed. */
const AWAY_MS = 30_000;

/**
 * Reload the current page's data when the user comes back to the app (the tab becomes visible or
 * the window gets focus) after being away for a while, so time reported elsewhere (another device,
 * an AI assistant) shows up without a manual refresh. The reload keeps the page's state and scroll
 * position, shows no progress bar, and also drops prefetched pages, which may be just as old.
 */
export function useRefreshOnReturn(): void {
    const { component, props } = usePage();
    const getCalendarDate = useEffectEvent(() =>
        component === 'time/index' && typeof props.date === 'string'
            ? props.date
            : undefined,
    );

    useEffect(() => {
        let awaySince: number | null =
            document.hidden || !document.hasFocus() ? Date.now() : null;
        let cancelRefresh: (() => void) | null = null;
        let foregroundVisit: string | null = null;

        const leave = () => {
            awaySince ??= Date.now();
        };

        const comeBack = () => {
            if (document.hidden || awaySince === null || foregroundVisit) {
                return;
            }

            if (Date.now() - awaySince < AWAY_MS) {
                awaySince = null;
                return;
            }

            if (!navigator.onLine || cancelRefresh) {
                return;
            }

            const staleSince = awaySince;
            awaySince = null;
            const retryOnReturn = () => {
                awaySince = staleSince;
                return false as const;
            };

            // Preserve the period already on screen, even if the URL defaults to today.
            const date = getCalendarDate();
            router.flushAll();
            router.reload({
                data: date ? { date } : undefined,
                preserveUrl: date !== undefined,
                preserveErrors: true,
                showProgress: false,
                onNetworkError: retryOnReturn,
                onHttpException: retryOnReturn,
                onCancelToken: ({ cancel }) => {
                    cancelRefresh = cancel;
                },
                onFinish: () => {
                    cancelRefresh = null;
                },
            });
        };

        const comeBackIfFocused = () => {
            if (document.hasFocus()) {
                comeBack();
            }
        };

        // A slow refresh must never replace the results of a period change or a save.
        const stopStartListener = router.on(
            'start',
            ({ detail: { visit } }) => {
                if (!visit.async) {
                    foregroundVisit = visit.id;
                    cancelRefresh?.();
                }
            },
        );
        const stopFinishListener = router.on(
            'finish',
            ({ detail: { visit } }) => {
                if (visit.id === foregroundVisit) {
                    foregroundVisit = null;
                    if (visit.completed && !document.hidden) {
                        awaySince = null;
                    }
                }
            },
        );

        const listeners = new AbortController();
        const { signal } = listeners;
        document.addEventListener(
            'visibilitychange',
            () => (document.hidden ? leave() : comeBack()),
            { signal },
        );
        window.addEventListener('blur', leave, { signal });
        window.addEventListener('focus', comeBack, { signal });
        window.addEventListener('pagehide', leave, { signal });
        window.addEventListener('pageshow', comeBack, { signal });
        window.addEventListener('online', comeBackIfFocused, { signal });

        return () => {
            listeners.abort();
            stopStartListener();
            stopFinishListener();
            cancelRefresh?.();
        };
    }, []);
}
