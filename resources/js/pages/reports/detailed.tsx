import { Button, Table } from '@heroui/react';
import type { SortDescriptor } from '@heroui/react';
import { router, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
    ColumnOrderStatus,
    ReorderableColumnHeader,
    columnOrderHeaderClassName,
    useColumnOrder,
} from '@/components/reorderable-column-header';
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
    weekStartsOn: number;
    entries: Paginated<ReportRow>;
    totals: ReportTotals;
};

type SortKey = ReportFilterValues['sort'];

const defaultColumnOrder = [
    'member',
    'project',
    'description',
    'duration',
    'amount',
] as const;
type DetailedColumn = (typeof defaultColumnOrder)[number];

const columnLabels: Record<DetailedColumn, string> = {
    member: 'Member',
    project: 'Project',
    description: 'Description',
    duration: 'Hours',
    amount: 'Amount',
};

export default function ReportsDetailed({
    filters,
    options,
    abilities,
    currency,
    weekStartsOn,
    entries,
    totals,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const { id: userId } = usePage().props.auth.user;
    const order = useColumnOrder({
        storageKey: `timereport:report-detailed-column-order:${userId}`,
        defaultOrder: defaultColumnOrder,
        isVisible: (column) =>
            (column !== 'member' || abilities.canViewTeam) &&
            (column !== 'amount' || abilities.canViewAmounts),
    });

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

    const renderCell = (column: DetailedColumn, entry: ReportRow) => {
        switch (column) {
            case 'member':
                return entry.memberName;
            case 'project':
                return (
                    <span className="flex items-center gap-2">
                        <ProjectDot color={entry.project.color} />
                        <span>
                            {entry.project.name}
                            {entry.project.clientName && (
                                <span className="block text-xs text-muted">
                                    {entry.project.clientName}
                                </span>
                            )}
                        </span>
                    </span>
                );
            case 'description':
                return (
                    <>
                        <span className="line-clamp-2">
                            {entry.description}
                        </span>
                        {entry.tags.length > 0 && (
                            <span className="mt-1 flex flex-wrap gap-1">
                                {entry.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="rounded-full bg-default px-2 py-0.5 text-xs text-default-foreground"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </span>
                        )}
                    </>
                );
            case 'duration':
                return (
                    <>
                        {formatDuration(entry.durationSeconds)}
                        {!entry.isBillable && (
                            <span className="block text-xs text-muted">
                                {t('Non-billable')}
                            </span>
                        )}
                    </>
                );
            case 'amount':
                return entry.amount !== null && entry.amount > 0
                    ? formatMoney(entry.amount, currency, intlLocale)
                    : '–';
        }
    };

    return (
        <ReportLayout
            current="detailed"
            filters={filters}
            actions={<ExportMenu type="detailed" filters={filters} />}
        >
            <ReportFilterBar
                filters={filters}
                options={options}
                weekStartsOn={weekStartsOn}
            />

            <ReportStats totals={totals} currency={currency} />

            <Table>
                <ColumnOrderStatus announcement={order.announcement} />
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
                        <Table.Header className={columnOrderHeaderClassName}>
                            <Table.Column
                                allowsSorting
                                id="date"
                                isRowHeader
                                className="text-sm font-medium whitespace-nowrap"
                            >
                                {({ sortDirection }) => (
                                    <Table.SortableColumnHeader
                                        className="gap-1"
                                        sortDirection={sortDirection}
                                    >
                                        {t('Date')}
                                    </Table.SortableColumnHeader>
                                )}
                            </Table.Column>
                            {order.columns.map((column) => {
                                const label = t(columnLabels[column]);
                                const sortable =
                                    column !== 'description' &&
                                    column !== 'amount';

                                return (
                                    <Table.Column
                                        key={column}
                                        id={column}
                                        textValue={label}
                                        aria-label={label}
                                        allowsSorting={sortable}
                                    >
                                        {(header) => (
                                            <ReorderableColumnHeader
                                                order={order}
                                                column={column}
                                                label={label}
                                                className={
                                                    column === 'amount'
                                                        ? 'justify-end'
                                                        : undefined
                                                }
                                            >
                                                {sortable ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 min-w-0 justify-start bg-transparent px-0 text-sm font-medium text-inherit"
                                                        onPress={() =>
                                                            header.sort(
                                                                header.sortDirection ===
                                                                    'ascending'
                                                                    ? 'descending'
                                                                    : 'ascending',
                                                            )
                                                        }
                                                    >
                                                        <Table.SortableColumnHeader
                                                            className="gap-1"
                                                            sortDirection={
                                                                header.sortDirection
                                                            }
                                                        >
                                                            {label}
                                                        </Table.SortableColumnHeader>
                                                    </Button>
                                                ) : undefined}
                                            </ReorderableColumnHeader>
                                        )}
                                    </Table.Column>
                                );
                            })}
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
                                    {order.columns.map((column) => (
                                        <Table.Cell
                                            key={column}
                                            className={
                                                column === 'amount'
                                                    ? 'text-right tabular-nums'
                                                    : column === 'duration'
                                                      ? 'tabular-nums'
                                                      : undefined
                                            }
                                        >
                                            {renderCell(column, entry)}
                                        </Table.Cell>
                                    ))}
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
