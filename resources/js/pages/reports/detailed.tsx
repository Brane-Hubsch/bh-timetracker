import { Button, Table } from '@heroui/react';
import type { SortDescriptor } from '@heroui/react';
import { router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProjectDot } from '@/components/project-dot';
import { ExportMenu } from '@/components/reports/export-menu';
import { ReportFilterBar } from '@/components/reports/report-filter-bar';
import { ReportLayout } from '@/components/reports/report-layout';
import { ReportStats } from '@/components/reports/report-stats';
import { formatMoney } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { reportQuery } from '@/lib/reports';
import { formatDate, formatDuration, timeOf } from '@/lib/time';
import type {
    Paginated,
    ReportAbilities,
    ReportFilterValues,
    ReportOptions,
    ReportRow,
    ReportTotals,
} from '@/types';

type Props = {
    filters: ReportFilterValues;
    options: ReportOptions;
    abilities: ReportAbilities;
    currency: string;
    entries: Paginated<ReportRow>;
    totals: ReportTotals;
};

type SortKey = ReportFilterValues['sort'];

export default function ReportsDetailed({
    filters,
    options,
    abilities,
    currency,
    entries,
    totals,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const showAmounts = abilities.canViewAmounts;

    const visit = (changes: Partial<ReportFilterValues>, page?: number) =>
        router.get(
            window.location.pathname,
            { ...reportQuery(filters, changes), page },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    const sortDescriptor: SortDescriptor = {
        column: filters.sort,
        direction: filters.direction === 'asc' ? 'ascending' : 'descending',
    };

    const sortable = (id: SortKey, label: string) => (
        <Table.Column allowsSorting id={id} isRowHeader={id === 'date'}>
            {({ sortDirection }) => (
                <Table.SortableColumnHeader sortDirection={sortDirection}>
                    {label}
                </Table.SortableColumnHeader>
            )}
        </Table.Column>
    );

    return (
        <ReportLayout
            current="detailed"
            filters={filters}
            actions={<ExportMenu type="detailed" filters={filters} />}
        >
            <ReportFilterBar filters={filters} options={options} />

            <ReportStats totals={totals} currency={currency} />

            <Table>
                <Table.ScrollContainer>
                    <Table.Content
                        aria-label={t('Detailed')}
                        className="min-w-[760px]"
                        sortDescriptor={sortDescriptor}
                        onSortChange={(descriptor) =>
                            visit({
                                sort: descriptor.column as SortKey,
                                direction:
                                    descriptor.direction === 'ascending'
                                        ? 'asc'
                                        : 'desc',
                            })
                        }
                        data-test="report-entries"
                    >
                        <Table.Header>
                            {sortable('date', t('Date'))}
                            {abilities.canViewTeam
                                ? sortable('member', t('Member'))
                                : null}
                            {sortable('project', t('Project'))}
                            <Table.Column>{t('Description')}</Table.Column>
                            {sortable('duration', t('Duration'))}
                            {showAmounts ? (
                                <Table.Column className="text-right">
                                    {t('Amount')}
                                </Table.Column>
                            ) : null}
                        </Table.Header>
                        <Table.Body
                            renderEmptyState={() => (
                                <p className="p-6 text-center text-sm text-muted">
                                    {t('No time in this period.')}
                                </p>
                            )}
                        >
                            {entries.data.map((entry) => (
                                <Table.Row key={entry.id} id={entry.id}>
                                    <Table.Cell>
                                        <span className="whitespace-nowrap first-letter:uppercase">
                                            {formatDate(entry.date, intlLocale)}
                                        </span>
                                        <span className="block text-xs text-muted tabular-nums">
                                            {timeOf(entry.start)}–
                                            {timeOf(entry.end)}
                                        </span>
                                    </Table.Cell>
                                    {abilities.canViewTeam ? (
                                        <Table.Cell>
                                            {entry.memberName}
                                        </Table.Cell>
                                    ) : null}
                                    <Table.Cell>
                                        <span className="flex items-center gap-2">
                                            <ProjectDot
                                                color={entry.project.color}
                                            />
                                            <span>
                                                {entry.project.name}
                                                {entry.project.clientName && (
                                                    <span className="block text-xs text-muted">
                                                        {
                                                            entry.project
                                                                .clientName
                                                        }
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <span className="line-clamp-2">
                                            {entry.description}
                                        </span>
                                    </Table.Cell>
                                    <Table.Cell className="tabular-nums">
                                        {formatDuration(entry.durationSeconds)}
                                        {!entry.isBillable && (
                                            <span className="block text-xs text-muted">
                                                {t('Non-billable')}
                                            </span>
                                        )}
                                    </Table.Cell>
                                    {showAmounts ? (
                                        <Table.Cell className="text-right tabular-nums">
                                            {entry.amount !== null &&
                                            entry.amount > 0
                                                ? formatMoney(
                                                      entry.amount,
                                                      currency,
                                                      intlLocale,
                                                  )
                                                : '–'}
                                        </Table.Cell>
                                    ) : null}
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table.Content>
                </Table.ScrollContainer>
            </Table>

            {entries.last_page > 1 && (
                <nav
                    className="flex items-center justify-between gap-3 text-sm"
                    aria-label={t('Pagination')}
                >
                    <span className="text-muted">
                        {t(':first–:last of :count entries', {
                            first: entries.from ?? 0,
                            last: entries.to ?? 0,
                            count: entries.total,
                        })}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            isDisabled={entries.current_page <= 1}
                            onPress={() => visit({}, entries.current_page - 1)}
                        >
                            <ChevronLeft className="size-4" />
                            {t('Previous')}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            isDisabled={
                                entries.current_page >= entries.last_page
                            }
                            onPress={() => visit({}, entries.current_page + 1)}
                        >
                            {t('Next')}
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </nav>
            )}
        </ReportLayout>
    );
}

ReportsDetailed.layout = { width: 'wide' };
