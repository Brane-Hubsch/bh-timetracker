import { router } from '@inertiajs/react';
import { SelectField } from '@/components/form/select-field';
import { AbsenceTable } from '@/components/reports/absence-table';
import { ExportMenu } from '@/components/reports/export-menu';
import { GroupTable } from '@/components/reports/group-table';
import { MemberProjectTable } from '@/components/reports/member-project-table';
import { ReportFilterBar } from '@/components/reports/report-filter-bar';
import { ReportLayout } from '@/components/reports/report-layout';
import { ReportStats } from '@/components/reports/report-stats';
import { TimelineChart } from '@/components/reports/timeline-chart';
import { SegmentedControl } from '@/components/segmented-control';
import { useTranslation } from '@/lib/i18n';
import { reportQuery } from '@/lib/reports';
import type {
    ReportAbilities,
    ReportAbsence,
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
    weekStartsOn: number;
    summary: ReportSummary;
    absence: ReportAbsence;
};

export default function ReportsSummary({
    filters,
    options,
    currency,
    weekStartsOn,
    summary,
    absence,
}: Props) {
    const { t } = useTranslation();
    const byMemberAndProject =
        filters.group === 'member' && filters.subgroup === 'project';

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
            <ReportFilterBar
                filters={filters}
                options={options}
                weekStartsOn={weekStartsOn}
            />

            <TimelineChart
                unit={summary.timeline.unit}
                buckets={summary.timeline.buckets}
                projects={summary.timeline.projects}
                tall={Boolean(filters.scale)}
                headerAction={
                    filters.scale && (
                        <SegmentedControl
                            aria-label={t('Chart scale')}
                            options={[
                                { id: 'week', label: t('Week') },
                                { id: 'month', label: t('Month') },
                            ]}
                            value={filters.scale}
                            onChange={(scale) => regroup({ scale })}
                        />
                    )
                }
            />

            <ReportStats totals={summary.totals} currency={currency} />

            <section className="grid grid-cols-1 gap-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <h2 className="text-base font-semibold">
                        {t('Breakdown')}
                    </h2>
                    <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto">
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
                            className="min-w-0 sm:w-44"
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
                            className="min-w-0 sm:w-44"
                            data-test="report-subgroup"
                        />
                    </div>
                </div>

                {byMemberAndProject ? (
                    <MemberProjectTable
                        groups={summary.groups}
                        members={options.members}
                        showAmounts={summary.totals.amount !== null}
                        currency={currency}
                    />
                ) : (
                    <GroupTable
                        groups={summary.groups}
                        totals={summary.totals}
                        grouping={filters.group}
                        subGrouping={filters.subgroup}
                        currency={currency}
                    />
                )}
                {(filters.group === 'tag' || filters.subgroup === 'tag') && (
                    <p className="text-sm text-muted">
                        {t(
                            'An entry with several tags counts under each of them, so the tags can add up to more than the total.',
                        )}
                    </p>
                )}
            </section>

            {absence.members.length > 0 && <AbsenceTable absence={absence} />}
        </ReportLayout>
    );
}

ReportsSummary.layout = { width: 'wide' };
