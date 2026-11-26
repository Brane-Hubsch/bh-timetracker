import { Button, Dropdown, Label } from '@heroui/react';
import { ArrowDownWideNarrow, Check, ChevronDown } from 'lucide-react';
import { ProjectDot } from '@/components/project-dot';
import { ReportEntryTags } from '@/components/reports/report-entry-tags';
import { MemberAvatar } from '@/components/reports/report-filter-options';
import { formatMoney } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { formatDate, formatDuration, timeOf } from '@/lib/time';
import type {
    Paginated,
    ReportAbilities,
    ReportFilterValues,
    ReportRow,
} from '@/types';

type SortKey = ReportFilterValues['sort'];
type Direction = ReportFilterValues['direction'];

export function MobileReportEntries({
    filters,
    entries,
    abilities,
    avatars,
    currency,
    onSort,
}: {
    filters: ReportFilterValues;
    entries: Paginated<ReportRow>;
    abilities: ReportAbilities;
    avatars: ReadonlyMap<string, string | null>;
    currency: string;
    onSort: (changes: Partial<ReportFilterValues>) => void;
}) {
    const { t, tc, intlLocale } = useTranslation();
    const sortLabels: Record<SortKey, string> = {
        date: t('Date'),
        duration: t('Time'),
        project: t('Project'),
        member: t('Member'),
    };
    const directionLabels: Record<Direction, string> = {
        desc: t(filters.sort === 'date' ? 'Newest first' : 'Descending'),
        asc: t(filters.sort === 'date' ? 'Oldest first' : 'Ascending'),
    };
    const sortKeys: SortKey[] = abilities.canViewTeam
        ? ['date', 'duration', 'project', 'member']
        : ['date', 'duration', 'project'];
    const grouped: { date: string | null; rows: ReportRow[] }[] = [];
    if (filters.sort === 'date') {
        for (const row of entries.data) {
            const group = grouped.at(-1);
            if (group?.date === row.date) {
                group.rows.push(row);
            } else {
                grouped.push({ date: row.date, rows: [row] });
            }
        }
    } else {
        grouped.push({ date: null, rows: entries.data });
    }

    return (
        <section className="md:hidden">
            <div className="flex min-h-11 items-center justify-between gap-2 px-4 py-2">
                <span className="text-[13px] text-muted">
                    {tc(':count entry|:count entries', entries.total)}
                </span>
                <Dropdown>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-0 text-[13px] font-medium"
                        aria-label={`${t('Sort')}, ${sortLabels[filters.sort]}, ${directionLabels[filters.direction]}`}
                        data-test="mobile-report-sort"
                    >
                        <ArrowDownWideNarrow
                            aria-hidden="true"
                            className="size-3.5"
                        />
                        {sortLabels[filters.sort]},{' '}
                        {directionLabels[filters.direction].toLocaleLowerCase(
                            intlLocale,
                        )}
                        <ChevronDown
                            aria-hidden="true"
                            className="size-3.5 text-muted"
                        />
                    </Button>
                    <Dropdown.Popover
                        placement="bottom end"
                        className="min-w-44"
                    >
                        <Dropdown.Menu aria-label={t('Sort')}>
                            <Dropdown.Section>
                                {sortKeys.map((sort) => (
                                    <Dropdown.Item
                                        key={sort}
                                        id={sort}
                                        textValue={sortLabels[sort]}
                                        onAction={() => onSort({ sort })}
                                    >
                                        <Label>{sortLabels[sort]}</Label>
                                        {filters.sort === sort && (
                                            <Check
                                                aria-hidden="true"
                                                className="ms-auto size-4 text-accent"
                                            />
                                        )}
                                    </Dropdown.Item>
                                ))}
                            </Dropdown.Section>
                            <Dropdown.Section className="mt-1 border-t border-separator pt-1">
                                {(['desc', 'asc'] as const).map((direction) => (
                                    <Dropdown.Item
                                        key={direction}
                                        id={direction}
                                        textValue={directionLabels[direction]}
                                        onAction={() => onSort({ direction })}
                                    >
                                        <Label>
                                            {directionLabels[direction]}
                                        </Label>
                                        {filters.direction === direction && (
                                            <Check
                                                aria-hidden="true"
                                                className="ms-auto size-4 text-accent"
                                            />
                                        )}
                                    </Dropdown.Item>
                                ))}
                            </Dropdown.Section>
                        </Dropdown.Menu>
                    </Dropdown.Popover>
                </Dropdown>
            </div>

            {entries.data.length === 0 && (
                <p className="p-6 text-center text-sm text-muted">
                    {t('No time in this period.')}
                </p>
            )}
            {grouped.map(({ date, rows }, index) => {
                const partial =
                    (index === 0 && entries.current_page > 1) ||
                    (index === grouped.length - 1 &&
                        entries.current_page < entries.last_page);

                return (
                    <div key={date ?? 'entries'}>
                        {date && (
                            <h2 className="sticky top-[calc(5.9375rem+env(safe-area-inset-top))] z-10 flex items-center justify-between gap-2 bg-background px-4 py-1.5 text-[13px]/[18px] font-semibold">
                                <span className="first-letter:uppercase">
                                    {formatDate(date, intlLocale, {
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'short',
                                    })}
                                </span>
                                {!partial && (
                                    <span className="font-medium text-muted tabular-nums">
                                        {formatDuration(
                                            rows.reduce(
                                                (sum, row) =>
                                                    sum + row.durationSeconds,
                                                0,
                                            ),
                                        )}
                                    </span>
                                )}
                            </h2>
                        )}
                        <ul>
                            {rows.map((row) => (
                                <li
                                    key={row.id}
                                    className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 px-4 py-3 not-last:after:pointer-events-none not-last:after:absolute not-last:after:inset-x-0 not-last:after:bottom-0 not-last:after:ms-9 not-last:after:border-b not-last:after:border-separator"
                                >
                                    <span className="flex h-5 items-center">
                                        <ProjectDot
                                            color={row.project.color}
                                            size="compact"
                                        />
                                    </span>
                                    <div className="grid min-w-0 gap-1">
                                        <div className="flex items-start justify-between gap-2 text-[15px]/5 font-medium">
                                            <span className="truncate">
                                                {row.project.name}
                                            </span>
                                            <span className="shrink-0 tabular-nums">
                                                {formatDuration(
                                                    row.durationSeconds,
                                                )}
                                            </span>
                                        </div>
                                        {row.description && (
                                            <p className="line-clamp-2 text-sm">
                                                {row.description}
                                            </p>
                                        )}
                                        <ReportEntryTags
                                            tags={row.tags}
                                            mobile
                                        />
                                        <div className="flex items-center justify-between gap-2 text-[13px]/[18px] text-muted">
                                            <div className="flex min-w-0 items-center gap-1.5">
                                                {abilities.canViewTeam && (
                                                    <MemberAvatar
                                                        name={row.memberName}
                                                        src={
                                                            avatars.get(
                                                                String(
                                                                    row.userId,
                                                                ),
                                                            ) ?? null
                                                        }
                                                        size="xs"
                                                    />
                                                )}
                                                <span className="truncate">
                                                    {[
                                                        abilities.canViewTeam &&
                                                            row.memberName,
                                                        `${timeOf(row.start)}–${timeOf(row.end)}`,
                                                        row.project.clientName,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </span>
                                            </div>
                                            <span className="shrink-0 tabular-nums">
                                                {!row.isBillable
                                                    ? t('Non-billable')
                                                    : abilities.canViewAmounts &&
                                                        row.amount !== null &&
                                                        row.amount > 0
                                                      ? formatMoney(
                                                            row.amount,
                                                            currency,
                                                            intlLocale,
                                                        )
                                                      : null}
                                            </span>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </section>
    );
}
