import { formatDecimalHours, formatMoney } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { ReportTotals } from '@/types';

type Props = {
    totals: ReportTotals;
    currency: string;
};

/**
 * Headline numbers: hours, billable hours and (for owners/admins) the billable amount.
 */
export function ReportStats({ totals, currency }: Props) {
    const { t, intlLocale } = useTranslation();
    const tiles = [
        {
            label: t('Hours'),
            value: formatDecimalHours(totals.seconds, intlLocale),
        },
        {
            label: t('Billable hours'),
            value: formatDecimalHours(totals.billableSeconds, intlLocale),
        },
        ...(totals.amount !== null
            ? [
                  {
                      label: t('Amount'),
                      value: formatMoney(totals.amount, currency, intlLocale),
                  },
              ]
            : []),
    ];

    return (
        <dl
            className={`grid gap-3 ${tiles.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
            data-test="report-stats"
        >
            {tiles.map((tile) => (
                <div
                    key={tile.label}
                    className="rounded-2xl bg-surface p-4 shadow-surface"
                >
                    <dt className="text-sm text-muted">{tile.label}</dt>
                    <dd className="text-2xl font-semibold tabular-nums">
                        {tile.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
