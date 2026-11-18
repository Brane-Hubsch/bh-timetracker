import { useSyncExternalStore } from 'react';

/**
 * Subscribe to a CSS media query, e.g. useMediaQuery('(min-width: 768px)').
 */
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (callback) => {
            const list = window.matchMedia(query);
            list.addEventListener('change', callback);

            return () => list.removeEventListener('change', callback);
        },
        () => window.matchMedia(query).matches,
        () => false,
    );
}

export function useIsDesktop(): boolean {
    return useMediaQuery('(min-width: 768px)');
}
