import { Table } from '@heroui/react';
import { usePage } from '@inertiajs/react';
import {
    ColumnOrderStatus,
    ReorderableColumnHeader,
    columnOrderHeaderClassName,
    useColumnOrder,
} from '@/components/reorderable-column-header';
import { formatDays } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { ReportAbsence } from '@/types';

type Props = {
    absence: ReportAbsence;
};

/**
 * Absence per member and type in working days (absence time ÷ the organization's working day).
 * Only types someone was absent for get a column.
 */
export function AbsenceTable({ absence }: Props) {
    const { t, intlLocale } = useTranslation();
    const { id: userId } = usePage().props.auth.user;
    const labels = new Map(
        absence.types.map((type) => [type.value, type.label]),
    );
    const order = useColumnOrder({
        storageKey: `timereport:report-absence-column-order:${userId}`,
        defaultOrder: [...labels.keys()],
        isVisible: (column) =>
            absence.members.some((member) => member.types[column]),
    });
    const days = (seconds: number | undefined) =>
        seconds
            ? formatDays(seconds / absence.workdaySeconds, intlLocale)
            : '–';

    return (
        <section className="grid grid-cols-1 gap-3" data-test="report-absence">
            <h2 className="text-base font-semibold">{t('Absence')}</h2>
            <Table>
                <ColumnOrderStatus announcement={order.announcement} />
                <Table.ScrollContainer>
                    <Table.Content
                        aria-label={t('Absence per member')}
                        className="min-w-[480px]"
                    >
                        <Table.Header className={columnOrderHeaderClassName}>
                            <Table.Column
                                isRowHeader
                                className="text-sm font-medium"
                            >
                                {t('Member')}
                            </Table.Column>
                            {order.columns.map((column) => {
                                const label = labels.get(column) ?? column;

                                return (
                                    <Table.Column
                                        key={column}
                                        id={column}
                                        textValue={label}
                                        className="text-right text-sm font-medium whitespace-nowrap"
                                    >
                                        <ReorderableColumnHeader
                                            order={order}
                                            column={column}
                                            label={label}
                                            align="end"
                                        />
                                    </Table.Column>
                                );
                            })}
                            <Table.Column className="text-right text-sm font-medium">
                                {t('Total')}
                            </Table.Column>
                        </Table.Header>
                        <Table.Body>
                            {absence.members.map((member) => (
                                <Table.Row key={member.id} id={member.id}>
                                    <Table.Cell className="font-medium">
                                        {member.name}
                                    </Table.Cell>
                                    {order.columns.map((column) => (
                                        <Table.Cell
                                            key={column}
                                            className="text-right text-muted tabular-nums"
                                        >
                                            {days(member.types[column])}
                                        </Table.Cell>
                                    ))}
                                    <Table.Cell className="text-right font-semibold tabular-nums">
                                        {days(member.seconds)}
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table.Content>
                </Table.ScrollContainer>
            </Table>
            <p className="text-sm text-muted">
                {t(
                    'Days are absence hours divided by the working day; weekends and holidays don’t count.',
                )}
            </p>
        </section>
    );
}
