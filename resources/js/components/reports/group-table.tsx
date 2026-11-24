import { Button, Dropdown, Table } from '@heroui/react';
import { usePage } from '@inertiajs/react';
import { GripVertical } from 'lucide-react';
import { useRef, useState, useSyncExternalStore } from 'react';
import { ProjectDot } from '@/components/project-dot';
import { formatDecimalHours, formatMoney } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { formatBucket } from '@/lib/reports';
import type { ReportGroup, ReportGroupingKey, ReportTotals } from '@/types';

type Props = {
    groups: ReportGroup[];
    totals: ReportTotals;
    grouping: ReportGroupingKey;
    subGrouping: ReportGroupingKey | 'none';
    currency: string;
};

type Line = ReportGroup & { id: string; level: 0 | 1; type: ReportGroupingKey };

const defaultColumnOrder = ['Share', 'Amount', 'Billable', 'Hours'] as const;
type MetricColumn = (typeof defaultColumnOrder)[number];

const columnOrderChanged = 'timereport:report-column-order-changed';
const columnDragType = 'application/x-timereport-report-column';

function subscribeToColumnOrder(listener: () => void) {
    window.addEventListener('storage', listener);
    window.addEventListener(columnOrderChanged, listener);

    return () => {
        window.removeEventListener('storage', listener);
        window.removeEventListener(columnOrderChanged, listener);
    };
}

function readSavedOrder(key: string) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function parseColumnOrder(savedOrder: string | null): readonly MetricColumn[] {
    try {
        const order: unknown = savedOrder && JSON.parse(savedOrder);

        if (
            Array.isArray(order) &&
            order.length === defaultColumnOrder.length &&
            defaultColumnOrder.every((column) => order.includes(column))
        ) {
            return order as MetricColumn[];
        }
    } catch {
        // An invalid preference falls back to the default order.
    }

    return defaultColumnOrder;
}

/**
 * The summary as a table: groups with their sub-groups indented, each with its share of the total
 * hours, and a total row.
 */
export function GroupTable({
    groups,
    totals,
    grouping,
    subGrouping,
    currency,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const { id: userId } = usePage().props.auth.user;
    const storageKey = `timereport:report-summary-column-order:${userId}`;
    const showAmounts = totals.amount !== null;
    const savedOrder = useSyncExternalStore(
        subscribeToColumnOrder,
        () => readSavedOrder(storageKey),
        () => null,
    );
    const [temporaryOrder, setTemporaryOrder] = useState<MetricColumn[]>();
    const [drag, setDrag] = useState<{
        source: MetricColumn;
        target?: MetricColumn;
    } | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const columnButtons = useRef<
        Partial<Record<MetricColumn, HTMLButtonElement>>
    >({});
    const pendingMenuMove = useRef<{
        column: MetricColumn;
        targetIndex: number;
    } | null>(null);
    const columnOrder = temporaryOrder ?? parseColumnOrder(savedOrder);
    const columns = columnOrder.filter(
        (column) => showAmounts || column !== 'Amount',
    );

    const moveColumn = (column: MetricColumn, targetIndex: number) => {
        const currentIndex = columns.indexOf(column);
        if (
            currentIndex < 0 ||
            targetIndex < 0 ||
            targetIndex >= columns.length ||
            currentIndex === targetIndex
        ) {
            return;
        }

        const nextOrder = [...columns];
        nextOrder.splice(currentIndex, 1);
        nextOrder.splice(targetIndex, 0, column);
        if (!showAmounts) {
            nextOrder.splice(columnOrder.indexOf('Amount'), 0, 'Amount');
        }

        try {
            localStorage.setItem(storageKey, JSON.stringify(nextOrder));
            setTemporaryOrder(undefined);
            window.dispatchEvent(new Event(columnOrderChanged));
        } catch {
            setTemporaryOrder(nextOrder);
        }

        setAnnouncement(
            t(':column moved to position :position of :count', {
                column: t(column),
                position: targetIndex + 1,
                count: columns.length,
            }),
        );
    };

    const percent = new Intl.NumberFormat(intlLocale, {
        style: 'percent',
        maximumFractionDigits: 0,
    });
    const share = (seconds: number) =>
        totals.seconds > 0 ? seconds / totals.seconds : 0;

    const lines: Line[] = groups.flatMap((group) => [
        { ...group, id: group.key, level: 0, type: grouping },
        ...(subGrouping === 'none'
            ? []
            : group.children.map((child) => ({
                  ...child,
                  id: `${group.key}:${child.key}`,
                  level: 1 as const,
                  type: subGrouping,
              }))),
    ]);

    const label = (line: Line) =>
        ['day', 'week', 'month'].includes(line.type)
            ? formatBucket(line.key, line.type, intlLocale, (week) =>
                  t('Week :number', { number: week }),
              )
            : line.label;

    const metricValue = (column: MetricColumn, row: ReportTotals) => {
        switch (column) {
            case 'Amount':
                return row.amount === null
                    ? ''
                    : formatMoney(row.amount, currency, intlLocale);
            case 'Billable':
                return formatDecimalHours(row.billableSeconds, intlLocale);
            case 'Hours':
                return formatDecimalHours(row.seconds, intlLocale);
            case 'Share':
                return '';
        }
    };

    return (
        <Table>
            <span role="status" className="sr-only">
                {announcement}
            </span>
            <Table.ScrollContainer>
                <Table.Content
                    aria-label={t('Summary')}
                    className="min-w-[560px]"
                    data-test="report-group-table"
                >
                    <Table.Header className="group/report-header">
                        <Table.Column isRowHeader className="w-full text-sm">
                            {t('Name')}
                        </Table.Column>
                        {columns.map((column, index) => (
                            <Table.Column
                                key={column}
                                id={column}
                                textValue={t(column)}
                                className="whitespace-nowrap"
                            >
                                <div
                                    data-drop-target={
                                        drag?.target === column || undefined
                                    }
                                    className={`flex min-h-7 items-center rounded-md data-[drop-target]:bg-accent/15 data-[drop-target]:ring-1 data-[drop-target]:ring-accent data-[drop-target]:ring-inset ${column === 'Share' ? 'justify-start' : 'justify-end'}`}
                                    onDragOver={(event) => {
                                        if (!drag || drag.source === column) {
                                            return;
                                        }
                                        event.preventDefault();
                                        event.dataTransfer.dropEffect = 'move';
                                        if (drag.target !== column) {
                                            setDrag({
                                                ...drag,
                                                target: column,
                                            });
                                        }
                                    }}
                                    onDragLeave={(event) => {
                                        if (
                                            drag?.target === column &&
                                            !(
                                                event.relatedTarget instanceof
                                                    Node &&
                                                event.currentTarget.contains(
                                                    event.relatedTarget,
                                                )
                                            )
                                        ) {
                                            setDrag({ source: drag.source });
                                        }
                                    }}
                                    onDrop={(event) => {
                                        if (
                                            drag &&
                                            event.dataTransfer.getData(
                                                columnDragType,
                                            ) === drag.source
                                        ) {
                                            event.preventDefault();
                                            moveColumn(drag.source, index);
                                            setDrag(null);
                                        }
                                    }}
                                >
                                    <span
                                        aria-hidden="true"
                                        draggable
                                        className="pointer-events-none flex size-6 shrink-0 cursor-grab items-center justify-center rounded-sm opacity-0 transition-opacity duration-150 group-hover/report-header:pointer-events-auto group-hover/report-header:opacity-70 hover:bg-default active:cursor-grabbing motion-reduce:transition-none"
                                        onDragStart={(event) => {
                                            event.dataTransfer.effectAllowed =
                                                'move';
                                            event.dataTransfer.setData(
                                                columnDragType,
                                                column,
                                            );
                                            setDrag({ source: column });
                                        }}
                                        onDragEnd={() => setDrag(null)}
                                    >
                                        <GripVertical className="pointer-events-none size-3.5" />
                                    </span>
                                    <Dropdown>
                                        <Button
                                            ref={(button) => {
                                                columnButtons.current[column] =
                                                    button ?? undefined;
                                            }}
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 min-w-0 px-0.5 text-inherit"
                                            aria-label={t(
                                                'Move column :column',
                                                { column: t(column) },
                                            )}
                                        >
                                            {t(column)}
                                        </Button>
                                        <Dropdown.Popover
                                            placement="bottom end"
                                            ref={(popover) => {
                                                const pending =
                                                    pendingMenuMove.current;
                                                if (
                                                    popover ||
                                                    pending?.column !== column
                                                ) {
                                                    return;
                                                }
                                                pendingMenuMove.current = null;
                                                // Let the menu finish restoring focus before moving its trigger.
                                                requestAnimationFrame(() => {
                                                    moveColumn(
                                                        column,
                                                        pending.targetIndex,
                                                    );
                                                    requestAnimationFrame(() =>
                                                        columnButtons.current[
                                                            column
                                                        ]?.focus(),
                                                    );
                                                });
                                            }}
                                        >
                                            <Dropdown.Menu
                                                onAction={(action) => {
                                                    pendingMenuMove.current = {
                                                        column,
                                                        targetIndex:
                                                            index +
                                                            (action === 'left'
                                                                ? -1
                                                                : 1),
                                                    };
                                                }}
                                            >
                                                <Dropdown.Item
                                                    id="left"
                                                    isDisabled={index === 0}
                                                >
                                                    {t('Move left')}
                                                </Dropdown.Item>
                                                <Dropdown.Item
                                                    id="right"
                                                    isDisabled={
                                                        index ===
                                                        columns.length - 1
                                                    }
                                                >
                                                    {t('Move right')}
                                                </Dropdown.Item>
                                            </Dropdown.Menu>
                                        </Dropdown.Popover>
                                    </Dropdown>
                                </div>
                            </Table.Column>
                        ))}
                    </Table.Header>
                    <Table.Body
                        renderEmptyState={() => (
                            <p className="p-6 text-center text-sm text-muted">
                                {t('No time in this period.')}
                            </p>
                        )}
                    >
                        {[
                            ...lines.map((line) => (
                                <Table.Row key={line.id} id={line.id}>
                                    <Table.Cell>
                                        <span
                                            className={`flex items-center gap-2 ${line.level === 1 ? 'pl-6 text-muted' : 'font-medium'}`}
                                        >
                                            {line.color && (
                                                <ProjectDot
                                                    color={line.color}
                                                />
                                            )}
                                            {label(line)}
                                        </span>
                                    </Table.Cell>
                                    {columns.map((column) =>
                                        column === 'Share' ? (
                                            <Table.Cell key={column}>
                                                <span className="flex items-center justify-between gap-2 text-sm whitespace-nowrap text-muted tabular-nums">
                                                    <span
                                                        className={`hidden h-2 w-24 shrink-0 rounded-full bg-default sm:block lg:w-32 xl:w-40 ${line.level === 1 ? 'invisible' : ''}`}
                                                        aria-hidden="true"
                                                    >
                                                        <span
                                                            className="block h-full origin-left animate-grow-x rounded-full bg-accent motion-safe:transition-[width] motion-safe:duration-300"
                                                            style={{
                                                                width: `${Math.min(1, share(line.seconds)) * 100}%`,
                                                                backgroundColor:
                                                                    line.color ??
                                                                    undefined,
                                                            }}
                                                        />
                                                    </span>
                                                    {percent.format(
                                                        share(line.seconds),
                                                    )}
                                                </span>
                                            </Table.Cell>
                                        ) : (
                                            <Table.Cell
                                                key={column}
                                                className="text-right whitespace-nowrap tabular-nums"
                                            >
                                                {metricValue(column, line)}
                                            </Table.Cell>
                                        ),
                                    )}
                                </Table.Row>
                            )),
                            ...(lines.length > 0
                                ? [
                                      <Table.Row
                                          key="total"
                                          id="total"
                                          className="[&>td]:border-t [&>td]:border-separator [&>td]:bg-default/40"
                                      >
                                          <Table.Cell>
                                              <span className="font-semibold">
                                                  {t('Total')}
                                              </span>
                                          </Table.Cell>
                                          {columns.map((column) => (
                                              <Table.Cell
                                                  key={column}
                                                  className="text-right font-semibold whitespace-nowrap tabular-nums"
                                              >
                                                  {metricValue(column, totals)}
                                              </Table.Cell>
                                          ))}
                                      </Table.Row>,
                                  ]
                                : []),
                        ]}
                    </Table.Body>
                </Table.Content>
            </Table.ScrollContainer>
        </Table>
    );
}
