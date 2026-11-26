import { Tabs } from '@heroui/react';
import { Head, router } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { MobilePageHeader } from '@/components/app-shell/mobile-page-header';
import Heading from '@/components/heading';
import {
    MobileReportFilters,
    MobileReportFilterSummary,
} from '@/components/reports/mobile-report-filters';
import { ReportPeriodPicker } from '@/components/reports/period-picker';
import { SegmentedControl } from '@/components/segmented-control';
import { useIsDesktop } from '@/hooks/use-media-query';
import type { useReportNavigation } from '@/hooks/use-report-navigation';
import { useTranslation } from '@/lib/i18n';
import { reportQuery } from '@/lib/reports';
import { detailed, projects, summary } from '@/routes/reports';
import type { ReportFilterValues, ReportOptions } from '@/types';

type ReportKind = 'summary' | 'detailed' | 'projects';

type Props = {
    current: ReportKind;
    /** Filters to carry over when switching between summary and detailed. */
    filters?: ReportFilterValues;
    actions?: ReactNode;
    mobileControls?: {
        navigation: ReturnType<typeof useReportNavigation>;
        options: ReportOptions;
        weekStartsOn: number;
        seconds: number;
    };
    children: ReactNode;
};

/**
 * Title, report tabs and actions shared by all report pages.
 */
export function ReportLayout({
    current,
    filters,
    actions,
    mobileControls,
    children,
}: Props) {
    const { t } = useTranslation();
    const isDesktop = useIsDesktop();

    const titles: Record<ReportKind, string> = {
        summary: t('Summary'),
        detailed: t('Detailed'),
        projects: t('Project follow-up'),
    };

    const open = (kind: ReportKind) => {
        const values = mobileControls?.navigation.filters ?? filters;
        const query = values ? reportQuery(values) : {};

        router.get(
            kind === 'summary'
                ? summary.url(undefined, { query })
                : kind === 'detailed'
                  ? detailed.url(undefined, { query })
                  : projects.url(),
        );
    };

    return (
        <>
            <Head title={`${t('Reports')} · ${titles[current]}`} />

            <div className="grid min-w-0 grid-cols-1 md:gap-6">
                {isDesktop ? (
                    <Heading
                        title={t('Reports')}
                        actions={actions}
                        className="max-md:hidden"
                    />
                ) : (
                    <MobilePageHeader className="report-mobile-header grid grid-cols-1 pb-2.5! md:hidden">
                        <div className="flex h-[34px] min-w-0 items-center gap-2">
                            <div className="min-w-0 flex-1">
                                <h1 className="text-[17px]/[21px] font-semibold">
                                    {t('Reports')}
                                </h1>
                                {mobileControls && (
                                    <MobileReportFilterSummary
                                        filters={
                                            mobileControls.navigation.filters
                                        }
                                        options={mobileControls.options}
                                    />
                                )}
                            </div>
                            {mobileControls && filters && (
                                <>
                                    <MobileReportFilters
                                        filters={
                                            mobileControls.navigation.filters
                                        }
                                        options={mobileControls.options}
                                        seconds={mobileControls.seconds}
                                        apply={mobileControls.navigation.apply}
                                    />
                                    <ReportPeriodPicker
                                        mobile
                                        className="max-w-[58%] min-w-0"
                                        period={filters.period}
                                        from={filters.from}
                                        to={filters.to}
                                        periods={mobileControls.options.periods}
                                        weekStartsOn={
                                            mobileControls.weekStartsOn
                                        }
                                        onChange={
                                            mobileControls.navigation.apply
                                        }
                                        onStep={mobileControls.navigation.step}
                                    />
                                </>
                            )}
                        </div>
                        <SegmentedControl
                            aria-label={t('Report type')}
                            fullWidth
                            options={[
                                { id: 'summary', label: titles.summary },
                                { id: 'detailed', label: titles.detailed },
                                { id: 'projects', label: t('Follow-up') },
                            ]}
                            value={current}
                            onChange={open}
                        />
                    </MobilePageHeader>
                )}

                <Tabs
                    selectedKey={current}
                    onSelectionChange={(key) => open(key as ReportKind)}
                    className="grid min-w-0 grid-cols-1 md:gap-6"
                >
                    <Tabs.ListContainer className="hidden overflow-x-auto md:block md:w-fit">
                        <Tabs.List aria-label={t('Reports')}>
                            {(Object.keys(titles) as ReportKind[]).map(
                                (kind) => (
                                    <Tabs.Tab
                                        key={kind}
                                        id={kind}
                                        data-test={`report-tab-${kind}`}
                                    >
                                        {titles[kind]}
                                        <Tabs.Indicator />
                                    </Tabs.Tab>
                                ),
                            )}
                        </Tabs.List>
                    </Tabs.ListContainer>

                    <Tabs.Panel
                        id={current}
                        className="grid min-w-0 grid-cols-1 p-0 md:gap-6"
                    >
                        {children}
                    </Tabs.Panel>
                </Tabs>
            </div>
        </>
    );
}
