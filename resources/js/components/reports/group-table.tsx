import { Table } from '@heroui/react';
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

/**
 * The summary as a table: groups with their sub-groups indented, and a total row.
 */
export function GroupTable({
    groups,
    totals,
    grouping,
    subGrouping,
    currency,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const showAmounts = totals.amount !== null;

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

    const money = (amount: number | null) =>
        amount === null ? '' : formatMoney(amount, currency, intlLocale);

    return (
        <Table>
            <Table.ScrollContainer>
                <Table.Content
                    aria-label={t('Summary')}
                    className="min-w-[480px]"
                    data-test="report-group-table"
                >
                    <Table.Header>
                        <Table.Column isRowHeader>{t('Name')}</Table.Column>
                        <Table.Column className="text-right">
                            {t('Hours')}
                        </Table.Column>
                        <Table.Column className="text-right">
                            {t('Billable')}
                        </Table.Column>
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
                                    <Table.Cell className="text-right tabular-nums">
                                        {formatDecimalHours(
                                            line.seconds,
                                            intlLocale,
                                        )}
                                    </Table.Cell>
                                    <Table.Cell className="text-right tabular-nums">
                                        {formatDecimalHours(
                                            line.billableSeconds,
                                            intlLocale,
                                        )}
                                    </Table.Cell>
                                    {showAmounts ? (
                                        <Table.Cell className="text-right tabular-nums">
                                            {money(line.amount)}
                                        </Table.Cell>
                                    ) : null}
                                </Table.Row>
                            )),
                            ...(lines.length > 0
                                ? [
                                      <Table.Row key="total" id="total">
                                          <Table.Cell>
                                              <span className="font-semibold">
                                                  {t('Total')}
                                              </span>
                                          </Table.Cell>
                                          <Table.Cell className="text-right font-semibold tabular-nums">
                                              {formatDecimalHours(
                                                  totals.seconds,
                                                  intlLocale,
                                              )}
                                          </Table.Cell>
                                          <Table.Cell className="text-right font-semibold tabular-nums">
                                              {formatDecimalHours(
                                                  totals.billableSeconds,
                                                  intlLocale,
                                              )}
                                          </Table.Cell>
                                          {showAmounts ? (
                                              <Table.Cell className="text-right font-semibold tabular-nums">
                                                  {money(totals.amount)}
                                              </Table.Cell>
                                          ) : null}
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
