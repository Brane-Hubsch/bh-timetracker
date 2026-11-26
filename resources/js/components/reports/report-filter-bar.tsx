import { Button } from '@heroui/react';
import { Banknote, X } from 'lucide-react';
import { FilterChip } from '@/components/reports/filter-chip';
import { ReportPeriodPicker } from '@/components/reports/period-picker';
import {
    activeReportFilters,
    clearReportFilters,
    useReportFilterOptions,
} from '@/components/reports/report-filter-options';
import { useTranslation } from '@/lib/i18n';
import type { ReportFilterValues, ReportOptions } from '@/types';

type Props = {
    filters: ReportFilterValues;
    options: ReportOptions;
    weekStartsOn: number;
    apply: (changes: Partial<ReportFilterValues>) => void;
};

export function ReportFilterBar({
    filters,
    options,
    weekStartsOn,
    apply,
}: Props) {
    const { t } = useTranslation();
    const selections = useReportFilterOptions(options);
    const activeFilters = activeReportFilters(filters);
    const billableLabels: Record<string, string> = {
        all: t('All entries'),
        '1': t('Billable'),
        '0': t('Non-billable'),
    };

    return (
        <div
            className="hidden flex-wrap items-center gap-2 md:flex"
            data-test="report-filters"
        >
            <ReportPeriodPicker
                period={filters.period}
                from={filters.from}
                to={filters.to}
                periods={options.periods}
                weekStartsOn={weekStartsOn}
                onChange={(changes) => apply(changes)}
            />

            <div
                aria-hidden="true"
                className="mx-1 hidden h-5.5 w-px bg-separator md:block"
            />

            {selections.map(({ key, ...selection }) => (
                <FilterChip
                    key={key}
                    {...selection}
                    value={filters[key]}
                    onChange={(value) => apply({ [key]: value })}
                    fitOptionLabels={key === 'members'}
                    activeLabel={
                        key === 'projects' && filters.projects.length > 2
                            ? t(':count projects', {
                                  count: filters.projects.length,
                              })
                            : undefined
                    }
                    data-test={`report-${key}`}
                />
            ))}

            <FilterChip
                label={t('Billing')}
                options={Object.entries(billableLabels).map(
                    ([value, label]) => ({ value, label }),
                )}
                value={[filters.billable ?? 'all']}
                onChange={([value]) =>
                    apply({
                        billable:
                            value === undefined || value === 'all'
                                ? null
                                : value,
                    })
                }
                selectionMode="single"
                isActive={filters.billable !== null}
                activeLabel={billableLabels[filters.billable ?? 'all']}
                icon={
                    <Banknote aria-hidden="true" className="size-4 shrink-0" />
                }
                data-test="report-billable"
            />

            {activeFilters > 0 && (
                <Button
                    variant="ghost"
                    className="h-9 shrink-0 rounded-full"
                    onPress={() => apply(clearReportFilters)}
                    data-test="report-filters-clear"
                >
                    <X className="size-4" />
                    {t('Clear filters')}
                </Button>
            )}
        </div>
    );
}
