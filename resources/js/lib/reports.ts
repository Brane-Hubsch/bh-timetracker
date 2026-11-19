import type { QueryParams } from '@/wayfinder';
import { formatDate, isoWeek } from '@/lib/time';
import type { ReportFilterValues, ReportGroupingKey } from '@/types';

/**
 * Report filters as query parameters, leaving out empty values so URLs stay short. The period's
 * dates are only sent for a custom period.
 */
export function reportQuery(
    filters: ReportFilterValues,
    changes: Partial<ReportFilterValues> = {},
): QueryParams {
    const values = { ...filters, ...changes };

    const query: QueryParams = {
        period: values.period,
        from: values.period === 'custom' ? values.from : undefined,
        to: values.period === 'custom' ? values.to : undefined,
        members: values.members,
        clients: values.clients,
        projects: values.projects,
        tags: values.tags,
        billable: values.billable ?? undefined,
        group: values.group,
        subgroup: values.subgroup,
        sort: values.sort,
        direction: values.direction,
    };

    return Object.fromEntries(
        Object.entries(query).filter(
            ([, value]) =>
                value !== undefined &&
                value !== null &&
                value !== '' &&
                !(Array.isArray(value) && value.length === 0),
        ),
    ) as QueryParams;
}

/**
 * Label of a time bucket key (a local "YYYY-MM-DD" date) for the given grouping.
 */
export function formatBucket(
    key: string,
    grouping: ReportGroupingKey | 'none',
    locale: string,
    weekLabel: (week: number) => string,
): string {
    switch (grouping) {
        case 'day':
            return formatDate(key, locale, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        case 'week':
            return `${weekLabel(isoWeek(key))} · ${formatDate(key, locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;
        case 'month':
            return formatDate(key, locale, { month: 'long', year: 'numeric' });
        default:
            return key;
    }
}
