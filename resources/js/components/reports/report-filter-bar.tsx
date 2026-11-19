import { router } from '@inertiajs/react';
import { useState } from 'react';
import { DatePickerField } from '@/components/form/date-picker-field';
import { MultiSelectField } from '@/components/form/multi-select-field';
import { SelectField } from '@/components/form/select-field';
import { useTranslation } from '@/lib/i18n';
import { reportQuery } from '@/lib/reports';
import type { ReportFilterValues, ReportOptions } from '@/types';

type Props = {
    filters: ReportFilterValues;
    options: ReportOptions;
};

/**
 * Period and filters in one row above the report. Every change updates the URL, so reports can be
 * bookmarked and shared.
 */
export function ReportFilterBar({ filters, options }: Props) {
    const { t } = useTranslation();
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

    const applyDates = (nextFrom: string, nextTo: string) => {
        setFrom(nextFrom);
        setTo(nextTo);

        if (nextFrom && nextTo && nextFrom <= nextTo) {
            apply({ period: 'custom', from: nextFrom, to: nextTo });
        }
    };

    return (
        <div
            className="grid grid-cols-1 gap-3 rounded-2xl bg-surface p-4 shadow-surface sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]"
            data-test="report-filters"
        >
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

            {options.members.length > 0 && (
                <MultiSelectField
                    label={t('Members')}
                    placeholder={t('All members')}
                    options={options.members}
                    value={filters.members}
                    onChange={(members) => apply({ members })}
                    data-test="report-members"
                />
            )}

            {options.clients.length > 0 && (
                <MultiSelectField
                    label={t('Clients')}
                    placeholder={t('All clients')}
                    options={options.clients}
                    value={filters.clients}
                    onChange={(clients) => apply({ clients })}
                    data-test="report-clients"
                />
            )}

            <MultiSelectField
                label={t('Projects')}
                placeholder={t('All projects')}
                options={options.projects}
                value={filters.projects}
                onChange={(projects) => apply({ projects })}
                data-test="report-projects"
            />

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
                    apply({ billable: billable === 'all' ? null : billable })
                }
                data-test="report-billable"
            />
        </div>
    );
}
