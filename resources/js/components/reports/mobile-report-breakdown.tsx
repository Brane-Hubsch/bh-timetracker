import { LogoImage } from '@/components/logo-image';
import { ProjectDot } from '@/components/project-dot';
import { MemberAvatar } from '@/components/reports/report-filter-options';
import { formatDecimalHours, formatMoney } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { formatBucket } from '@/lib/reports';
import type {
    ReportClientOption,
    ReportGroup,
    ReportGroupingKey,
    ReportTotals,
} from '@/types';

type Props = {
    groups: ReportGroup[];
    totals: ReportTotals;
    avatars: ReadonlyMap<string, string | null>;
    clients: ReportClientOption[];
    grouping: ReportGroupingKey;
    subGrouping: ReportGroupingKey | 'none';
    currency: string;
};

export function MobileReportBreakdown({
    groups,
    totals,
    avatars,
    clients,
    grouping,
    subGrouping,
    currency,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const logos = new Map(clients.map(({ value, logo }) => [value, logo]));
    const hours = (seconds: number) => formatDecimalHours(seconds, intlLocale);
    const details = (row: ReportTotals) =>
        [
            t(':hours billable', { hours: hours(row.billableSeconds) }),
            row.amount !== null
                ? formatMoney(row.amount, currency, intlLocale)
                : null,
        ]
            .filter(Boolean)
            .join(' · ');
    const percentage = new Intl.NumberFormat(intlLocale, {
        style: 'percent',
        maximumFractionDigits: 0,
    });
    const label = (group: ReportGroup, kind: ReportGroupingKey | 'none') =>
        kind === 'day' || kind === 'week' || kind === 'month'
            ? formatBucket(group.key, kind, intlLocale, (week) =>
                  t('Week :number', { number: week }),
              )
            : group.label;

    const leading = (
        group: ReportGroup,
        kind: ReportGroupingKey | 'none',
        child = false,
    ) => {
        switch (kind) {
            case 'client':
                return (
                    <LogoImage
                        src={logos.get(group.key)}
                        name={group.label}
                        size={child ? 16 : 24}
                        className="rounded-md"
                    />
                );
            case 'member':
                return (
                    <MemberAvatar
                        name={group.label}
                        src={avatars.get(group.key) ?? null}
                        size={child ? 'xs' : 'list'}
                    />
                );
            case 'project':
                return (
                    group.color && <ProjectDot color={group.color} size="sm" />
                );
            default:
                return null;
        }
    };

    return (
        <div className="border-t border-separator md:hidden">
            {groups.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted">
                    {t('No time in this period.')}
                </p>
            ) : (
                <ul className="ps-4">
                    {groups.map((group) => {
                        const share =
                            totals.seconds > 0
                                ? group.seconds / totals.seconds
                                : 0;
                        const icon = leading(group, grouping);

                        return (
                            <li
                                key={group.key}
                                className="border-b border-separator py-3 pe-4 last:border-b-0"
                            >
                                <div className="flex gap-3">
                                    {icon && (
                                        <div className="grid size-6 shrink-0 place-items-center">
                                            {icon}
                                        </div>
                                    )}
                                    <div className="grid min-w-0 flex-1 gap-1">
                                        <div className="flex min-w-0 items-center justify-between gap-2 text-[15px]/5 font-medium">
                                            <span className="truncate">
                                                {label(group, grouping)}
                                            </span>
                                            <span className="shrink-0 tabular-nums">
                                                {hours(group.seconds)}
                                            </span>
                                        </div>
                                        <p className="text-[13px]/[18px] text-muted">
                                            {details(group)}
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="h-1 flex-1 overflow-hidden rounded-full bg-default"
                                                aria-hidden="true"
                                            >
                                                <div
                                                    className="h-full rounded-full bg-accent"
                                                    style={{
                                                        width: `${Math.min(100, share * 100)}%`,
                                                        backgroundColor:
                                                            grouping ===
                                                            'project'
                                                                ? (group.color ??
                                                                  undefined)
                                                                : undefined,
                                                    }}
                                                />
                                            </div>
                                            <span className="w-7 shrink-0 text-right text-xs whitespace-nowrap text-muted">
                                                {percentage.format(share)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {group.children.length > 0 && (
                                    <ul className="mt-2 ps-9">
                                        {group.children.map((child) => (
                                            <li
                                                key={child.key}
                                                className="flex min-h-[34px] items-center gap-2 text-sm"
                                            >
                                                {leading(
                                                    child,
                                                    subGrouping,
                                                    true,
                                                )}
                                                <span className="min-w-0 flex-1 truncate">
                                                    {label(child, subGrouping)}
                                                </span>
                                                <span className="shrink-0 text-muted tabular-nums">
                                                    {hours(child.seconds)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            <div className="border-t border-separator bg-default/40 px-4 py-3">
                <div className="flex justify-between gap-2 text-[15px]/5 font-semibold">
                    <span>{t('Total')}</span>
                    <span className="tabular-nums">
                        {hours(totals.seconds)}
                    </span>
                </div>
                <p className="mt-1 text-[13px]/[18px] text-muted">
                    {details(totals)}
                </p>
            </div>
        </div>
    );
}
