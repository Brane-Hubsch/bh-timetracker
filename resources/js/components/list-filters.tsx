import { SearchField } from '@heroui/react';
import { router } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { SegmentedControl } from '@/components/segmented-control';
import { useTranslation } from '@/lib/i18n';

export type ListFilterValues = Record<
    string,
    string | number | null | undefined
>;

type Props = {
    filters: ListFilterValues & { search?: string; status?: string };
    /** Extra filters, e.g. a client select. Call `apply` with changed values. */
    children?: (apply: (changes: ListFilterValues) => void) => ReactNode;
};

/**
 * Search + active/archived tabs for list pages. Filters live in the URL so lists can be bookmarked.
 */
export function ListFilters({ filters, children }: Props) {
    const { t } = useTranslation();
    const [search, setSearch] = useState(filters.search ?? '');
    const isFirstRender = useRef(true);

    const apply = (changes: ListFilterValues) => {
        const query = Object.fromEntries(
            Object.entries({ ...filters, ...changes }).filter(
                ([, value]) =>
                    value !== '' && value !== null && value !== undefined,
            ),
        );

        router.get(window.location.pathname, query, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    // Debounce typing.
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;

            return;
        }

        const timeout = window.setTimeout(() => apply({ search }), 300);

        return () => window.clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchField
                aria-label={t('Search')}
                value={search}
                onChange={setSearch}
                className="w-full sm:max-w-xs"
            >
                <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={t('Search')} />
                    <SearchField.ClearButton />
                </SearchField.Group>
            </SearchField>

            {children?.(apply)}

            <SegmentedControl
                aria-label={t('Status')}
                value={filters.status === 'archived' ? 'archived' : 'active'}
                onChange={(status) => apply({ status })}
                options={[
                    { id: 'active', label: t('Active (plural)') },
                    { id: 'archived', label: t('Archived (plural)') },
                ]}
                className="sm:ml-auto"
                data-test="status-filter"
            />
        </div>
    );
}
