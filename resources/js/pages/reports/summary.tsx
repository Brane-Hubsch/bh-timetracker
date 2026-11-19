import { router } from '@inertiajs/react';
import { SelectField } from '@/components/form/select-field';
import { ExportMenu } from '@/components/reports/export-menu';
import { GroupTable } from '@/components/reports/group-table';
import { ProjectDistribution } from '@/components/reports/project-distribution';
import { ReportFilterBar } from '@/components/reports/report-filter-bar';
import { ReportLayout } from '@/components/reports/report-layout';
import { ReportStats } from '@/components/reports/report-stats';
import { TimelineChart } from '@/components/reports/timeline-chart';
import { useTranslation } from '@/lib/i18n';
import { reportQuery } from '@/lib/reports';
import type {
    ReportAbilities,
    ReportFilterValues,
    ReportGroupingKey,
    ReportOptions,
    ReportSummary,
} from '@/types';

type Props = {
    filters: ReportFilterValues;
    options: ReportOptions;
    abilities: ReportAbilities;
    currency: string;
    summary: ReportSummary;
};

export default function ReportsSummary({
    filters,
    options,
    currency,
    summary,
}: Props) {
    const { t } = useTranslation();

    const regroup = (changes: Partial<ReportFilterValues>) =>
        router.get(window.location.pathname, reportQuery(filters, changes), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });

    return (
        <ReportLayout
            current="summary"
            filters={filters}
            actions={<ExportMenu type="summary" filters={filters} />}
        >
            <ReportFilterBar filters={filters} options={options} />

            <ReportStats totals={summary.totals} currency={currency} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3">
                    <TimelineChart
                        unit={summary.timeline.unit}
                        buckets={summary.timeline.buckets}
                    />
                </div>
                <div className="lg:col-span-2">
                    <ProjectDistribution
                        projects={summary.projects}
                        totalSeconds={summary.totals.seconds}
                    />
                </div>
            </div>

            <section className="grid grid-cols-1 gap-3">
                <div className="flex flex-wrap items-end gap-3">
                    <SelectField
                        name="group"
                        label={t('Group by')}
                        options={options.groupings}
                        value={filters.group}
                        onChange={(group) =>
                            regroup({
                                group: group as ReportGroupingKey,
                                subgroup:
                                    filters.subgroup === group
                                        ? 'none'
                                        : filters.subgroup,
                            })
                        }
                        className="w-44"
                        data-test="report-group"
                    />
                    <SelectField
                        name="subgroup"
                        label={t('Then by')}
                        options={[
                            { value: 'none', label: t('Nothing') },
                            ...options.groupings.filter(
                                (option) => option.value !== filters.group,
                            ),
                        ]}
                        value={filters.subgroup}
                        onChange={(subgroup) =>
                            regroup({
                                subgroup: subgroup as
                                    | ReportGroupingKey
                                    | 'none',
                            })
                        }
                        className="w-44"
                        data-test="report-subgroup"
                    />
                </div>

                <GroupTable
                    groups={summary.groups}
                    totals={summary.totals}
                    grouping={filters.group}
                    subGrouping={filters.subgroup}
                    currency={currency}
                />
            </section>
        </ReportLayout>
    );
}

ReportsSummary.layout = { width: 'wide' };
