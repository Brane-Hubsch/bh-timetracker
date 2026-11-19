import { Tabs } from '@heroui/react';
import { Head, router } from '@inertiajs/react';
import type { ReactNode } from 'react';
import Heading from '@/components/heading';
import { useTranslation } from '@/lib/i18n';
import { reportQuery } from '@/lib/reports';
import { detailed, projects, summary } from '@/routes/reports';
import type { ReportFilterValues } from '@/types';

type ReportKind = 'summary' | 'detailed' | 'projects';

type Props = {
    current: ReportKind;
    /** Filters to carry over when switching between summary and detailed. */
    filters?: ReportFilterValues;
    actions?: ReactNode;
    children: ReactNode;
};

/**
 * Title, report tabs and actions shared by all report pages.
 */
export function ReportLayout({ current, filters, actions, children }: Props) {
    const { t } = useTranslation();

    const titles: Record<ReportKind, string> = {
        summary: t('Summary'),
        detailed: t('Detailed'),
        projects: t('Project follow-up'),
    };

    const open = (kind: ReportKind) => {
        const query = filters ? reportQuery(filters) : {};

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

            <div className="grid grid-cols-1 gap-6">
                <Heading title={t('Reports')} actions={actions} />

                <Tabs
                    selectedKey={current}
                    onSelectionChange={(key) => open(key as ReportKind)}
                    className="grid grid-cols-1 gap-6"
                >
                    <Tabs.ListContainer className="overflow-x-auto sm:w-fit">
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
                        className="grid grid-cols-1 gap-6 p-0"
                    >
                        {children}
                    </Tabs.Panel>
                </Tabs>
            </div>
        </>
    );
}
