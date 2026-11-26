import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

export type SearchStatusFilters = {
    search: string;
    status: 'active' | 'archived';
};

export const defaultSearchStatus: SearchStatusFilters = {
    search: '',
    status: 'active',
};

export function useMobileListFilters<Filters extends SearchStatusFilters>(
    url: string,
    filters: Filters,
    defaults: Filters,
) {
    const [isOpen, setIsOpen] = useState(false);
    const [draftSearch, setDraftSearch] = useState<string | null>(null);
    const [pending, setPending] = useState<Filters | null>(null);
    const searchTimer = useRef<number | undefined>(undefined);
    const current = pending ?? filters;
    const search = draftSearch ?? current.search;

    useEffect(() => () => window.clearTimeout(searchTimer.current), []);

    function apply(changes: Partial<Filters>, nextSearch = search) {
        window.clearTimeout(searchTimer.current);
        setDraftSearch(null);
        const next = { ...current, search: nextSearch.trim(), ...changes };
        const query = Object.fromEntries(
            Object.entries(next).filter(
                ([key, value]) => value !== defaults[key as keyof Filters],
            ),
        );

        setPending(next);
        router.get(url, query, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onFinish: () =>
                setPending((value) => (value === next ? null : value)),
        });
    }

    function changeSearch(value: string) {
        setDraftSearch(value);
        window.clearTimeout(searchTimer.current);
        searchTimer.current = window.setTimeout(() => apply({}, value), 300);
    }

    function changeOpen(open: boolean) {
        if (!open && draftSearch !== null) {
            apply({}, draftSearch);
        }
        setIsOpen(open);
    }

    return { current, search, isOpen, changeOpen, apply, changeSearch };
}
