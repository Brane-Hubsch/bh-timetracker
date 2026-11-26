import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { SelectField } from '@/components/form/select-field';
import { AbsenceTable } from '@/components/reports/absence-table';
import { ExportMenu } from '@/components/reports/export-menu';
import { GroupTable } from '@/components/reports/group-table';
import { MobileReportAbsence } from '@/components/reports/mobile-report-absence';
import { MobileReportBreakdown } from '@/components/reports/mobile-report-breakdown';
import { MemberProjectTable } from '@/components/reports/member-project-table';
import { ReportFilterBar } from '@/components/reports/report-filter-bar';
import { ReportLayout } from '@/components/reports/report-layout';
import { ReportStats } from '@/components/reports/report-stats';
import { TimelineChart } from '@/components/reports/timeline-chart';
import { SegmentedControl } from '@/components/segmented-control';
import { useReportNavigation } from '@/hooks/use-report-navigation';
import { useTranslation } from '@/lib/i18n';
import { reportMemberAvatars } from '@/lib/reports';
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
    const avatars = reportMemberAvatars(
        options.members,
        usePage().props.auth.user,
    );
    const byMemberAndProject =
        filters.group === 'member' && filters.subgroup === 'project';

    const navigation = useReportNavigation('summary', filters);
    const { apply: regroup, adjacentUrl } = navigation;
    const [previews, setPreviews] = useState<
        Partial<
            Record<-1 | 1, { url: string; timeline: ReportSummary['timeline'] }>
        >
    >({});

    function prefetchPeriod(direction: -1 | 1) {
        const url = adjacentUrl(direction);
        router.prefetch(url, {
            onPrefetched: (response) => {
                const { props } = JSON.parse(response.data) as { props: Props };
                setPreviews((current) => ({
                    ...current,
                    [direction]: { url, timeline: props.summary.timeline },
                }));
            },
        });
    }

    return (
        <ReportLayout
            current="summary"
            filters={filters}
            actions={<ExportMenu type="summary" filters={filters} />}
            mobileControls={{
                navigation,
                options,
                weekStartsOn,
                seconds: summary.totals.seconds,
            }}
        >
            <ReportFilterBar
                filters={filters}
                options={options}
                weekStartsOn={weekStartsOn}
                apply={regroup}
            />

            <TimelineChart
                unit={summary.timeline.unit}
                buckets={summary.timeline.buckets}
                projects={summary.timeline.projects}
                report={{
                    weekStartsOn,
                    onSwipe: navigation.step,
                    onSwipeIntent: prefetchPeriod,
                    adjacentTimeline: (direction) => {
                        const preview = previews[direction];
                        return preview?.url === adjacentUrl(direction)
                            ? preview.timeline
                            : undefined;
                    },
                }}
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
                            className="shrink-0"
                        />
                    )
                }
            />

            <ReportStats totals={summary.totals} currency={currency} />

            <section className="grid grid-cols-1 gap-3">
                <div className="flex flex-wrap items-end justify-between gap-3 max-md:px-4 max-md:pt-[18px]">
                    <h2 className="text-[15px]/5 font-semibold md:text-base">
                        {t('Breakdown')}
                    </h2>
                    <div className="grid w-full grid-cols-2 gap-3 md:flex md:w-auto">
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
                            className="min-w-0 md:w-44 max-md:[&>[data-slot=label]]:text-xs max-md:[&>[data-slot=label]]:text-muted"
                            triggerClassName="max-md:h-9 max-md:min-h-9 max-md:text-sm max-md:shadow-none"
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
                            className="min-w-0 md:w-44 max-md:[&>[data-slot=label]]:text-xs max-md:[&>[data-slot=label]]:text-muted"
                            triggerClassName="max-md:h-9 max-md:min-h-9 max-md:text-sm max-md:shadow-none"
                            data-test="report-subgroup"
                        />
                    </div>
                </div>

                <MobileReportBreakdown
                    groups={summary.groups}
                    totals={summary.totals}
                    avatars={avatars}
                    clients={options.clients}
                    grouping={filters.group}
                    subGrouping={filters.subgroup}
                    currency={currency}
                />

                <div className="hidden md:block">
                    {byMemberAndProject ? (
                        <MemberProjectTable
                            groups={summary.groups}
                            avatars={avatars}
                            showAmounts={summary.totals.amount !== null}
                            currency={currency}
                        />
                    ) : (
                        <GroupTable
                            groups={summary.groups}
                            totals={summary.totals}
                            avatars={avatars}
                            grouping={filters.group}
                            subGrouping={filters.subgroup}
                            currency={currency}
                        />
                    )}
                </div>
                {(filters.group === 'tag' || filters.subgroup === 'tag') && (
                    <p className="text-xs text-muted max-md:px-4 md:text-sm">
                        {t(
                            'An entry with several tags counts under each of them, so the tags can add up to more than the total.',
                        )}
                    </p>
                )}
            </section>

            {absence.members.length > 0 && (
                <>
                    <MobileReportAbsence absence={absence} avatars={avatars} />
                    <div className="hidden md:block">
                        <AbsenceTable absence={absence} avatars={avatars} />
                    </div>
                </>
            )}
            <div className="px-4 pt-6 pb-6 md:hidden">
                <ExportMenu type="summary" filters={filters} mobile />
            </div>
        </ReportLayout>
    );
}

ReportsSummary.layout = { width: 'wide' };
