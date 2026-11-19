import { Button } from '@heroui/react';
import { router } from '@inertiajs/react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { DatePickerField } from '@/components/form/date-picker-field';
import { MultiSelectField } from '@/components/form/multi-select-field';
import { SelectField } from '@/components/form/select-field';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useTranslation } from '@/lib/i18n';
import { reportQuery } from '@/lib/reports';
import type { ReportFilterValues, ReportOptions } from '@/types';

type Props = {
    filters: ReportFilterValues;
    options: ReportOptions;
};

/**
 * Period and filters in one row above the report. Every change updates the URL, so reports can be
 * bookmarked and shared. On mobile the filters beyond the period fold away behind a button that
 * shows how many are active.
 */
export function ReportFilterBar({ filters, options }: Props) {
    const { t } = useTranslation();
    const isDesktop = useIsDesktop();
    const [isExpanded, setIsExpanded] = useState(false);
    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const [shown, setShown] = useState({ from: filters.from, to: filters.to });

    // Follow the period the server resolved (e.g. after choosing "Last month").
    if (filters.from !== shown.from || filters.to !== shown.to) {
        setShown({ from: filters.from, to: filters.to });
        setFrom(filters.from);
        setTo(filters.to);
    }

    const apply = (changes: Partial<ReportFilterValues>) =>
        router.get(window.location.pathname, reportQuery(filters, changes), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });

    const activeFilters =
        [
            filters.members,
            filters.clients,
            filters.projects,
            filters.tags,
        ].filter((values) => values.length > 0).length +
        (filters.billable === null ? 0 : 1);
    const showFilters = isDesktop || isExpanded;

    const clearFilters = () =>
        apply({
            members: [],
            clients: [],
            projects: [],
            tags: [],
            billable: null,
        });

    const applyDates = (nextFrom: string, nextTo: string) => {
        setFrom(nextFrom);
        setTo(nextTo);

        if (nextFrom && nextTo && nextFrom <= nextTo) {
            apply({ period: 'custom', from: nextFrom, to: nextTo });
        }
    };

    return (
        <div
            className="grid grid-cols-1 gap-3 rounded-2xl bg-surface p-4 shadow-surface"
            data-test="report-filters"
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">
                <SelectField
                    name="period"
                    label={t('Period')}
                    options={options.periods}
                    value={filters.period}
                    onChange={(period) =>
                        period === 'custom'
                            ? applyDates(filters.from, filters.to)
                            : apply({ period })
                    }
                    data-test="report-period"
                />

                <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                    <DatePickerField
                        label={t('From')}
                        value={from}
                        onChange={(value) => applyDates(value, to)}
                        className="min-w-0"
                        data-test="report-from"
                    />
                    <DatePickerField
                        label={t('To')}
                        value={to}
                        onChange={(value) => applyDates(from, value)}
                        className="min-w-0"
                        data-test="report-to"
                    />
                </div>

                {showFilters && options.members.length > 0 && (
                    <MultiSelectField
                        label={t('Members')}
                        placeholder={t('All members')}
                        options={options.members}
                        value={filters.members}
                        onChange={(members) => apply({ members })}
                        data-test="report-members"
                    />
                )}

                {showFilters && options.clients.length > 0 && (
                    <MultiSelectField
                        label={t('Clients')}
                        placeholder={t('All clients')}
                        options={options.clients}
                        value={filters.clients}
                        onChange={(clients) => apply({ clients })}
                        data-test="report-clients"
                    />
                )}

                {showFilters && (
                    <MultiSelectField
                        label={t('Projects')}
                        placeholder={t('All projects')}
                        options={options.projects}
                        value={filters.projects}
                        onChange={(projects) => apply({ projects })}
                        data-test="report-projects"
                    />
                )}

                {showFilters && options.tags.length > 0 && (
                    <MultiSelectField
                        label={t('Tags')}
                        placeholder={t('All tags')}
                        options={options.tags}
                        value={filters.tags}
                        onChange={(tags) => apply({ tags })}
                        data-test="report-tags"
                    />
                )}

                {showFilters && (
                    <SelectField
                        name="billable"
                        label={t('Billable')}
                        options={[
                            { value: 'all', label: t('All entries') },
                            { value: '1', label: t('Billable only') },
                            { value: '0', label: t('Non-billable only') },
                        ]}
                        value={filters.billable ?? 'all'}
                        onChange={(billable) =>
                            apply({
                                billable: billable === 'all' ? null : billable,
                            })
                        }
                        data-test="report-billable"
                    />
                )}
            </div>

            {(!isDesktop || activeFilters > 0) && (
                <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
                    {!isDesktop && (
                        <Button
                            variant="tertiary"
                            size="sm"
                            onPress={() => setIsExpanded(!isExpanded)}
                            aria-expanded={isExpanded}
                            data-test="report-filters-toggle"
                        >
                            <SlidersHorizontal className="size-4" />
                            {isExpanded ? t('Hide filters') : t('Filters')}
                            {activeFilters > 0 && (
                                <span className="flex size-5 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground tabular-nums">
                                    {activeFilters}
                                </span>
                            )}
                        </Button>
                    )}
                    {activeFilters > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onPress={clearFilters}
                            data-test="report-filters-clear"
                        >
                            <X className="size-4" />
                            {t('Clear filters')}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
