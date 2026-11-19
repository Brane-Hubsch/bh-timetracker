import { formatDecimalHours, formatMoney } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { ReportTotals } from '@/types';

type Props = {
    totals: ReportTotals;
    currency: string;
};

type Tile = { label: string; value: string; hint: string | null };

/**
 * Headline numbers: hours, billable hours and (for owners/admins) the billable amount, each with
 * a line of context (non-billable time, billable share, average rate).
 */
export function ReportStats({ totals, currency }: Props) {
    const { t, intlLocale } = useTranslation();
    const percent = new Intl.NumberFormat(intlLocale, {
        style: 'percent',
        maximumFractionDigits: 0,
    });
    const nonBillableSeconds = totals.seconds - totals.billableSeconds;

    const tiles: Tile[] = [
        {
            label: t('Hours'),
            value: formatDecimalHours(totals.seconds, intlLocale),
            hint:
                nonBillableSeconds > 0
                    ? t(':hours non-billable', {
                          hours: formatDecimalHours(
                              nonBillableSeconds,
                              intlLocale,
                          ),
                      })
                    : null,
        },
        {
            label: t('Billable hours'),
            value: formatDecimalHours(totals.billableSeconds, intlLocale),
            hint:
                totals.seconds > 0
                    ? t(':percent of the hours', {
                          percent: percent.format(
                              totals.billableSeconds / totals.seconds,
                          ),
                      })
                    : null,
        },
        ...(totals.amount !== null
            ? [
                  {
                      label: t('Amount'),
                      value: formatMoney(totals.amount, currency, intlLocale),
                      hint:
                          totals.billableSeconds > 0
                              ? t(':rate per billable hour on average', {
                                    rate: formatMoney(
                                        // Whole currency units: the average needs no öre.
                                        Math.round(
                                            totals.amount /
                                                (totals.billableSeconds /
                                                    3600) /
                                                100,
                                        ) * 100,
                                        currency,
                                        intlLocale,
                                    ),
                                })
                              : null,
                  },
              ]
            : []),
    ];

    return (
        <dl
            className={`grid grid-cols-2 gap-3 ${tiles.length === 3 ? 'sm:grid-cols-3' : ''}`}
            data-test="report-stats"
        >
            {tiles.map((tile, index) => (
                <div
                    key={tile.label}
                    className={`grid content-start gap-1 rounded-2xl bg-surface p-4 shadow-surface ${tiles.length === 3 && index === 2 ? 'col-span-2 sm:col-span-1' : ''}`}
                >
                    <dt className="text-sm text-muted">{tile.label}</dt>
                    <dd className="text-xl font-semibold sm:text-2xl">
                        {tile.value}
                    </dd>
                    {tile.hint && (
                        <dd className="text-xs text-muted sm:text-sm">
                            {tile.hint}
                        </dd>
                    )}
                </div>
            ))}
        </dl>
    );
}
