import { router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { currentPeriodLike, reportQuery, shiftPeriod } from '@/lib/reports';
import { useShortcut } from '@/lib/shortcuts';
import { detailed, summary } from '@/routes/reports';
import type { ReportFilterValues } from '@/types';

export function useReportNavigation(
    kind: 'summary' | 'detailed',
    filters: ReportFilterValues,
) {
    const route = kind === 'summary' ? summary : detailed;
    const [pending, setPending] = useState<ReportFilterValues | null>(null);
    const latest = useRef<ReportFilterValues | null>(null);
    const current = pending ?? filters;
    const hasRange = Boolean(filters.from && filters.to);

    const urlFor = (values: ReportFilterValues, page?: number) =>
        route.url(undefined, { query: { ...reportQuery(values), page } });

    function apply(
        changes: Partial<ReportFilterValues>,
        page?: number,
        onFinish?: () => void,
    ) {
        const next = { ...(latest.current ?? filters), ...changes };
        latest.current = next;
        setPending(next);

        router.get(
            urlFor(next, page),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onFinish: () => {
                    if (latest.current === next) {
                        latest.current = null;
                        setPending(null);
                    }
                    onFinish?.();
                },
            },
        );
    }

    const stepChanges = (direction: -1 | 1): Partial<ReportFilterValues> => {
        const { from, to } = latest.current ?? filters;
        return { period: 'custom', ...shiftPeriod(from, to, direction) };
    };
    const step = (direction: -1 | 1, onFinish?: () => void) =>
        apply(stepChanges(direction), undefined, onFinish);

    useShortcut('previous', hasRange ? () => step(-1) : undefined);
    useShortcut('next', hasRange ? () => step(1) : undefined);
    useShortcut('today', () =>
        apply({ period: currentPeriodLike(filters.from, filters.to) }),
    );

    return {
        apply,
        filters: current,
        step: hasRange ? step : undefined,
        adjacentUrl: (direction: -1 | 1) =>
            urlFor({
                ...current,
                period: 'custom',
                ...shiftPeriod(current.from, current.to, direction),
            }),
    };
}
