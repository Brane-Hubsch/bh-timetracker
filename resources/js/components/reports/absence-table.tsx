import { Table } from '@heroui/react';
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
    const types = absence.types.filter((type) =>
        absence.members.some((member) => member.types[type.value]),
    );
    const days = (seconds: number | undefined) =>
        seconds
            ? formatDays(seconds / absence.workdaySeconds, intlLocale)
            : '–';

    return (
        <section className="grid grid-cols-1 gap-3" data-test="report-absence">
            <h2 className="text-base font-semibold">{t('Absence')}</h2>
            <Table>
                <Table.ScrollContainer>
                    <Table.Content
                        aria-label={t('Absence per member')}
                        className="min-w-[480px]"
                    >
                        <Table.Header>
                            <Table.Column isRowHeader>
                                {t('Member')}
                            </Table.Column>
                            {types.map((type) => (
                                <Table.Column
                                    key={type.value}
                                    className="text-right"
                                >
                                    {type.label}
                                </Table.Column>
                            ))}
                            <Table.Column className="text-right">
                                {t('Total')}
                            </Table.Column>
                        </Table.Header>
                        <Table.Body>
                            {absence.members.map((member) => (
                                <Table.Row key={member.id} id={member.id}>
                                    <Table.Cell className="font-medium">
                                        {member.name}
                                    </Table.Cell>
                                    {types.map((type) => (
                                        <Table.Cell
                                            key={type.value}
                                            className="text-right text-muted tabular-nums"
                                        >
                                            {days(member.types[type.value])}
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
