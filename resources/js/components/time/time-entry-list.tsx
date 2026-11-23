import { CalendarOff, Clock } from 'lucide-react';
import { ProjectDot } from '@/components/project-dot';
import { formatHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { formatDate, formatDuration, timeOf } from '@/lib/time';
import type { Absence, ColleagueOff, TimeEntry } from '@/types';

type Props = {
    dates: string[];
    today: string;
    entries: TimeEntry[];
    absences: Absence[];
    colleaguesOff: ColleagueOff[];
    onEdit: (entry: TimeEntry) => void;
    onEditAbsence: (absence: Absence) => void;
    onAdd: (date: string) => void;
};

/**
 * The week grouped by day, with day totals. Default view on mobile.
 */
export function TimeEntryList({
    dates,
    today,
    entries,
    absences,
    colleaguesOff,
    onEdit,
    onEditAbsence,
    onAdd,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const covers = (
        period: { startsOn: string; endsOn: string },
        date: string,
    ) => period.startsOn <= date && date <= period.endsOn;

    return (
        <div className="grid gap-4">
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
                const dayOff = colleaguesOff.filter((off) => covers(off, date));

                if (
                    dayEntries.length === 0 &&
                    dayAbsences.length === 0 &&
                    date !== today
                ) {
                    return null;
                }

                return (
                    <section
                        key={date}
                        className="grid gap-2"
                        data-test="time-day"
                    >
                        <header className="flex items-center justify-between px-1 text-sm">
                            <span className="font-medium first-letter:uppercase">
                                {date === today
                                    ? t('Today')
                                    : formatDate(date, intlLocale, {
                                          weekday: 'long',
                                          day: 'numeric',
                                          month: 'short',
                                      })}
                            </span>
                            <span className="font-medium tabular-nums">
                                {formatDuration(total)}
                            </span>
                        </header>
                        {dayOff.length > 0 && (
                            <p
                                className="truncate px-1 text-xs text-muted"
                                data-test="time-day-off"
                            >
                                {t('Off: :names', {
                                    names: dayOff
                                        .map((off) => off.name)
                                        .join(', '),
                                })}
                            </p>
                        )}
                        <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface shadow-surface">
                            {dayAbsences.map((absence) => (
                                <li key={`absence-${absence.id}`}>
                                    <button
                                        type="button"
                                        onClick={() => onEditAbsence(absence)}
                                        className="flex w-full items-center gap-3 border-l-3 border-warning bg-warning-soft p-4 text-left text-warning-soft-foreground transition-colors hover:bg-warning-soft-hover"
                                        data-test="time-absence-row"
                                    >
                                        <CalendarOff className="size-4 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate font-medium">
                                                {absence.label}
                                            </div>
                                            {absence.note && (
                                                <div className="truncate text-sm opacity-80">
                                                    {absence.note}
                                                </div>
                                            )}
                                        </div>
                                        <div className="shrink-0 text-sm font-medium tabular-nums">
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
                                <li key={entry.id}>
                                    <button
                                        type="button"
                                        onClick={() => onEdit(entry)}
                                        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-secondary"
                                        data-test="time-entry-row"
                                    >
                                        <ProjectDot
                                            color={entry.project.color}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate font-medium">
                                                {entry.project.name}
                                                {entry.project.clientName && (
                                                    <span className="ml-1 font-normal text-muted">
                                                        ·{' '}
                                                        {
                                                            entry.project
                                                                .clientName
                                                        }
                                                    </span>
                                                )}
                                            </div>
                                            <div className="truncate text-sm text-muted">
                                                {entry.description ||
                                                    t('No description')}
                                            </div>
                                            {entry.tags.length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap gap-1">
                                                    {entry.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="rounded-full bg-default px-2 py-0.5 text-xs text-default-foreground"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="shrink-0 text-right text-sm tabular-nums">
                                            <div className="font-medium">
                                                {formatDuration(
                                                    entry.durationSeconds,
                                                )}
                                            </div>
                                            <div className="text-muted">
                                                {timeOf(entry.start)}–
                                                {timeOf(entry.end)}
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                            {dayEntries.length === 0 &&
                                dayAbsences.length === 0 && (
                                    <li>
                                        <button
                                            type="button"
                                            onClick={() => onAdd(date)}
                                            className="flex w-full items-center justify-center gap-2 p-6 text-sm text-muted transition-colors hover:bg-surface-secondary"
                                        >
                                            <Clock className="size-4" />
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
                !dates.includes(today) && (
                    <p className="rounded-2xl bg-surface p-8 text-center text-sm text-muted shadow-surface">
                        {t('No time reported this week.')}
                    </p>
                )}
        </div>
    );
}
