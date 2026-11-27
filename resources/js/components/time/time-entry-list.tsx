import { CalendarDays, CalendarOff, Clock } from 'lucide-react';
import { ProjectDot } from '@/components/project-dot';
import {
    MobileTimeEntryRow,
    mobileTimeEntryDivider,
} from '@/components/time/mobile-time-entry-row';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import { formatHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { formatDate, formatDuration, timeOf } from '@/lib/time';
import { cn } from '@/lib/utils';
import type {
    Absence,
    CalendarHoliday,
    ColleagueOff,
    TimeEntry,
} from '@/types';

type Props = {
    dates: string[];
    today: string;
    entries: TimeEntry[];
    absences: Absence[];
    colleaguesOff: ColleagueOff[];
    holidays: CalendarHoliday[];
    isMobile: boolean;
    hasTimer: boolean;
    onSwipe: (direction: -1 | 1, onFinish: () => void) => void;
    onSwipeIntent: (direction: -1 | 1) => void;
    onEdit: (entry: TimeEntry) => void;
    onEditAbsence: (absence: Absence) => void;
    onAdd: (date: string) => void;
};

/**
 * The week grouped by day, with day totals.
 */
export function TimeEntryList({
    dates,
    today,
    entries,
    absences,
    colleaguesOff,
    holidays,
    isMobile,
    hasTimer,
    onSwipe,
    onSwipeIntent,
    onEdit,
    onEditAbsence,
    onAdd,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const { track, viewportProps } = useSwipeNavigation({
        followFinger: false,
        onSwipe: isMobile ? onSwipe : undefined,
        onSwipeIntent,
    });
    const holidayByDate = new Map(
        holidays.map(({ date, name }) => [date, name]),
    );
    const covers = (
        period: { startsOn: string; endsOn: string },
        date: string,
    ) => period.startsOn <= date && date <= period.endsOn;

    const list = (
        <div ref={track} className="max-md:pb-20 md:grid md:gap-4">
            {dates.map((date) => {
                const dayEntries = entries.filter(
                    (entry) => entry.date === date,
                );
                const total = dayEntries.reduce(
                    (sum, entry) => sum + entry.durationSeconds,
                    0,
                );

                const dayAbsences = absences.filter((absence) =>
                    covers(absence, date),
                );
                const holiday = holidayByDate.get(date);
                const dayOff = colleaguesOff.filter((off) => covers(off, date));

                if (
                    dayEntries.length === 0 &&
                    dayAbsences.length === 0 &&
                    !holiday &&
                    date !== today
                ) {
                    return null;
                }

                return (
                    <section
                        key={date}
                        className="md:grid md:gap-2"
                        data-test="time-day"
                    >
                        <header className="max-md:sticky max-md:top-(--mobile-page-header-visible-height) max-md:z-10 max-md:bg-surface max-md:px-4 max-md:py-1.5 max-md:shadow-[0_1px_4px_#0000000a] md:space-y-2 md:px-1">
                            <div className="flex items-start justify-between gap-2 text-[13px]/[18px] md:text-sm">
                                <h2 className="font-semibold first-letter:uppercase md:font-medium">
                                    {date === today
                                        ? t('Today')
                                        : formatDate(date, intlLocale, {
                                              weekday: 'long',
                                              day: 'numeric',
                                              month: 'short',
                                          })}
                                </h2>
                                <span className="shrink-0 font-medium tabular-nums max-md:text-muted">
                                    {formatDuration(total)}
                                </span>
                            </div>
                            {dayOff.length > 0 && (
                                <p
                                    className="truncate text-xs text-muted"
                                    data-test="time-day-off"
                                >
                                    {t('Off: :names', {
                                        names: dayOff
                                            .map((off) => off.name)
                                            .join(', '),
                                    })}
                                </p>
                            )}
                        </header>
                        <ul className="md:divide-y md:divide-separator md:overflow-hidden md:rounded-2xl md:bg-surface md:shadow-surface">
                            {holiday && (
                                <li
                                    className="flex items-center gap-2 bg-danger-soft px-4 py-2.5 text-[13px]/[18px] font-medium text-danger-soft-foreground"
                                    data-test="time-day-holiday"
                                >
                                    <CalendarDays
                                        className="size-3.5 shrink-0"
                                        aria-hidden="true"
                                    />
                                    <span className="truncate">{holiday}</span>
                                </li>
                            )}
                            {dayAbsences.map((absence) => (
                                <li key={`absence-${absence.id}`}>
                                    <button
                                        type="button"
                                        onClick={() => onEditAbsence(absence)}
                                        className="flex w-full items-center gap-2.5 border-l-3 border-warning bg-warning-soft px-4 py-3 text-left text-warning-soft-foreground transition-colors hover:bg-warning-soft-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus max-md:active:bg-warning-soft-hover md:gap-3 md:p-4"
                                        data-test="time-absence-row"
                                    >
                                        <CalendarOff
                                            className="size-4 shrink-0"
                                            aria-hidden
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium max-md:text-[15px]/5 max-md:wrap-anywhere md:truncate">
                                                {absence.label}
                                            </div>
                                            {absence.note && (
                                                <div className="text-[13px]/[18px] opacity-80 max-md:wrap-anywhere md:truncate md:text-sm">
                                                    {absence.note}
                                                </div>
                                            )}
                                        </div>
                                        <div className="shrink-0 text-[13px]/[18px] font-medium tabular-nums md:text-sm">
                                            {absence.secondsPerDay === null
                                                ? t('Full day')
                                                : formatHours(
                                                      absence.secondsPerDay,
                                                      intlLocale,
                                                  )}
                                        </div>
                                    </button>
                                </li>
                            ))}
                            {dayEntries.map((entry) => (
                                <li
                                    key={entry.id}
                                    className={
                                        isMobile
                                            ? mobileTimeEntryDivider
                                            : undefined
                                    }
                                >
                                    {isMobile ? (
                                        <MobileTimeEntryRow
                                            entry={entry}
                                            emptyDescription={t(
                                                'No description',
                                            )}
                                            onPress={() => onEdit(entry)}
                                        />
                                    ) : (
                                        <DesktopTimeEntryRow
                                            entry={entry}
                                            emptyDescription={t(
                                                'No description',
                                            )}
                                            onPress={() => onEdit(entry)}
                                        />
                                    )}
                                </li>
                            ))}
                            {dayEntries.length === 0 &&
                                dayAbsences.length === 0 &&
                                !holiday && (
                                    <li>
                                        <button
                                            type="button"
                                            onClick={() => onAdd(date)}
                                            className="flex w-full items-center justify-center gap-2 p-6 text-sm text-muted transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                                        >
                                            <Clock
                                                className="size-4"
                                                aria-hidden
                                            />
                                            {t('No time reported yet')}
                                        </button>
                                    </li>
                                )}
                        </ul>
                    </section>
                );
            })}
            {entries.length === 0 &&
                absences.length === 0 &&
                holidays.length === 0 &&
                !dates.includes(today) && (
                    <p className="text-center max-md:flex max-md:flex-col max-md:items-center max-md:gap-3 max-md:px-4 max-md:pt-[min(12.5rem,25svh)] max-md:text-[15px] max-md:font-medium md:rounded-2xl md:bg-surface md:p-8 md:text-sm md:text-muted md:shadow-surface">
                        <span className="grid size-13 place-items-center rounded-full bg-default text-muted md:hidden">
                            <Clock className="size-5" aria-hidden />
                        </span>
                        {t('No time reported this week.')}
                    </p>
                )}
        </div>
    );

    return (
        <div
            {...viewportProps}
            className={cn(
                'max-md:touch-pan-y max-md:touch-pinch-zoom max-md:overflow-x-clip',
                hasTimer
                    ? 'max-md:min-h-[calc(100svh-var(--mobile-page-header-visible-height)-var(--mobile-tab-bar-height)-var(--mobile-timer-space))]'
                    : 'max-md:min-h-[calc(100svh-var(--mobile-page-header-visible-height)-var(--mobile-tab-bar-height))]',
            )}
        >
            {list}
        </div>
    );
}

function DesktopTimeEntryRow({
    entry,
    emptyDescription,
    onPress,
}: {
    entry: TimeEntry;
    emptyDescription: string;
    onPress: () => void;
}) {
    const { project, description, tags, start, end, durationSeconds } = entry;

    return (
        <button
            type="button"
            onClick={onPress}
            className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 p-4 text-left transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            data-test="time-entry-row"
        >
            <ProjectDot
                color={project.color}
                className="row-span-2 row-start-1 size-3 self-center"
            />
            <span className="col-start-2 row-start-1 truncate font-medium">
                {project.name}
                {project.clientName && (
                    <span className="ms-1 font-normal text-muted">
                        · {project.clientName}
                    </span>
                )}
            </span>
            <span className="col-start-3 row-start-1 text-right text-sm font-medium tabular-nums">
                {formatDuration(durationSeconds)}
            </span>
            <span className="col-start-2 row-start-2 flex items-start gap-2">
                <span
                    className={cn(
                        'min-w-0 truncate text-sm/5',
                        description
                            ? 'text-muted'
                            : 'text-muted/85 dark:text-muted/80',
                    )}
                >
                    {description || emptyDescription}
                </span>
                {tags.length > 0 && (
                    <span className="flex max-w-[60%] shrink-0 flex-wrap gap-1">
                        {tags.map((tag) => (
                            <span
                                key={tag}
                                className="max-w-full truncate rounded-full bg-default px-2 py-0.5 text-xs text-default-foreground"
                            >
                                {tag}
                            </span>
                        ))}
                    </span>
                )}
            </span>
            <span className="col-start-3 row-start-2 text-right text-sm text-muted tabular-nums">
                {timeOf(start)} – {timeOf(end)}
            </span>
        </button>
    );
}
