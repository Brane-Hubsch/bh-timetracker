import { router } from '@inertiajs/react';
import { useEffect } from 'react';

/**
 * Run `open` once when the page was opened with `?{param}=…` (e.g. from the command palette), then
 * remove the parameters from the address bar so a reload does not open it again.
 */
export function useOpenFromQuery(
    param: string,
    open: (params: URLSearchParams) => void,
    alsoRemove: string[] = [],
): void {
    useEffect(() => {
        const url = new URL(window.location.href);

        if (!url.searchParams.has(param)) {
            return;
        }

        open(url.searchParams);

        [param, ...alsoRemove].forEach((key) => url.searchParams.delete(key));
        // A client-side visit, so Inertia's own page state and history entry get the clean URL too.
        router.replace({
            url: url.pathname + url.search + url.hash,
            preserveState: true,
            preserveScroll: true,
        });
        // Only on the first render of the page.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
