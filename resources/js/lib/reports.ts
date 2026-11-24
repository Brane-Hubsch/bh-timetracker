import type { QueryParams } from '@/wayfinder';
import { addDays, formatDate, isoWeek } from '@/lib/time';
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
        scale: values.scale === 'month' ? values.scale : undefined,
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

function monthStart(date: string): string {
    return `${date.slice(0, 7)}-01`;
}

function addMonths(date: string, months: number): string {
    const value = new Date(`${monthStart(date)}T00:00:00Z`);
    value.setUTCMonth(value.getUTCMonth() + months);

    return value.toISOString().slice(0, 10);
}

function monthEnd(date: string): string {
    return addDays(addMonths(date, 1), -1);
}

function daysBetween(from: string, to: string): number {
    return (
        Math.round(
            (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
                86400000,
        ) + 1
    );
}

/** Whether the range covers whole calendar months (e.g. 1 Nov – 31 Dec). */
function isWholeMonths(from: string, to: string): boolean {
    return from === monthStart(from) && to === monthEnd(to);
}

/**
 * The period before or after the given one, of the same length: whole months step by months (so
 * November becomes October, not 30 days earlier), other ranges by their number of days.
 */
export function shiftPeriod(
    from: string,
    to: string,
    direction: -1 | 1,
): { from: string; to: string } {
    if (isWholeMonths(from, to)) {
        const months =
            (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
            Number(to.slice(5, 7)) -
            Number(from.slice(5, 7)) +
            1;
        const nextFrom = addMonths(from, direction * months);

        return {
            from: nextFrom,
            to: monthEnd(addMonths(nextFrom, months - 1)),
        };
    }

    const days = daysBetween(from, to) * direction;

    return { from: addDays(from, days), to: addDays(to, days) };
}

/**
 * A short name for a custom period when it is a recognisable one: a month ("November 2026"), a week
 * starting on the organization's first weekday ("Vecka 47") or a year ("2026"). Null otherwise.
 */
export function customPeriodName(
    from: string,
    to: string,
    weekStartsOn: number,
    locale: string,
    weekLabel: (week: number) => string,
): string | null {
    if (isWholeMonths(from, to) && from.slice(0, 7) === to.slice(0, 7)) {
        return formatDate(from, locale, { month: 'long', year: 'numeric' });
    }

    if (from.endsWith('-01-01') && to === `${from.slice(0, 4)}-12-31`) {
        return from.slice(0, 4);
    }

    const weekday = new Date(`${from}T00:00:00Z`).getUTCDay() || 7;

    if (daysBetween(from, to) === 7 && weekday === weekStartsOn) {
        return weekLabel(isoWeek(from));
    }

    return null;
}
