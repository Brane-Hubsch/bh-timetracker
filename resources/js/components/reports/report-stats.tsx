import { formatDecimalHours, formatMoney } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { ReportTotals } from '@/types';

type Props = {
    totals: ReportTotals;
    currency: string;
};

type Tile = {
    label: string;
    value: string;
    hint: string | null;
    mobileHint?: string | null;
    mobileLabel?: string;
};

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

    const averageHours = totals.reportedDays
        ? new Intl.NumberFormat(intlLocale, {
              maximumFractionDigits: 1,
          }).format(totals.seconds / 3600 / totals.reportedDays)
        : null;
    const rate =
        totals.amount !== null && totals.billableSeconds > 0
            ? formatMoney(
                  Math.round(
                      totals.amount / (totals.billableSeconds / 3600) / 100,
                  ) * 100,
                  currency,
                  intlLocale,
              )
            : null;

    const tiles: Tile[] = [
        {
            label: t('Hours'),
            mobileHint: averageHours
                ? t('Average :hours h/day', { hours: averageHours })
                : null,
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
            mobileLabel: t('Billable'),
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
                      hint: rate
                          ? t(':rate per billable hour on average', { rate })
                          : null,
                      mobileHint: rate ? t('Average :rate/h', { rate }) : null,
                  },
              ]
            : []),
    ];

    return (
        <dl
            className={`grid border-y border-separator px-1.5 pt-3 pb-3.5 max-md:divide-x max-md:divide-separator md:gap-3 md:border-0 md:p-0 ${tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
            data-test="report-stats"
        >
            {tiles.map((tile) => (
                <div
                    key={tile.label}
                    className="grid min-w-0 content-start max-md:ps-2.5 max-md:pe-0.5 md:gap-1 md:rounded-2xl md:bg-surface md:p-4 md:shadow-surface"
                >
                    <dt className="text-xs font-medium text-muted max-md:truncate md:text-sm md:font-normal">
                        {tile.mobileLabel ? (
                            <>
                                <span className="md:hidden">
                                    {tile.mobileLabel}
                                </span>
                                <span className="hidden md:inline">
                                    {tile.label}
                                </span>
                            </>
                        ) : (
                            tile.label
                        )}
                    </dt>
                    <dd className="text-lg/6 font-semibold tabular-nums max-md:truncate md:text-2xl">
                        {tile.value}
                    </dd>
                    {tile.mobileHint === undefined && tile.hint && (
                        <dd className="text-xs text-muted max-md:truncate md:text-sm">
                            {tile.hint}
                        </dd>
                    )}
                    {tile.mobileHint !== undefined && (
                        <>
                            {tile.mobileHint && (
                                <dd className="text-xs text-muted max-md:truncate md:hidden">
                                    {tile.mobileHint}
                                </dd>
                            )}
                            {tile.hint && (
                                <dd className="hidden text-sm text-muted md:block">
                                    {tile.hint}
                                </dd>
                            )}
                        </>
                    )}
                </div>
            ))}
        </dl>
    );
}
