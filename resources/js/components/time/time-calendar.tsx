import FullCalendar from '@fullcalendar/react';
import type { CalendarRef } from '@fullcalendar/react';
import interactionPlugin from '@fullcalendar/react/interaction';
import svLocale from '@fullcalendar/react/locales/sv';
import classicTheme from '@fullcalendar/react/themes/classic';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import { Banknote } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
    formatDate,
    formatDuration,
    fromCalendarDate,
    timeOf,
} from '@/lib/time';
import type { TimeEntry } from '@/types';

type Props = {
    view: 'week' | 'day';
    date: string;
    weekStartsOn: number;
    now: string;
    entries: TimeEntry[];
    /** Drag on an empty slot. */
    onSelect: (start: string, end: string) => void;
    onEdit: (entry: TimeEntry) => void;
    /** Moved or resized; call revert() if saving fails. */
    onChange: (
        entry: TimeEntry,
        start: string,
        end: string,
        revert: () => void,
    ) => void;
};

/**
 * Fills the viewport below the calendar's top edge, so it uses all available height whatever the
 * toolbar above it wraps to. It stops at the content area's bottom padding, which on mobile also
 * keeps it clear of the bottom navigation, so the page itself never scrolls.
 */
function useFillHeight(): [
    React.RefObject<HTMLDivElement | null>,
    number | string,
] {
    const ref = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | null>(null);

    useLayoutEffect(() => {
        const measure = () => {
            const element = ref.current;

            if (!element) {
                return;
            }

            const top = element.getBoundingClientRect().top + window.scrollY;
            const main = element.closest('main');
            const bottomPadding = main
                ? Number.parseFloat(getComputedStyle(main).paddingBottom)
                : 0;

            setHeight(
                Math.max(
                    240,
                    Math.floor(window.innerHeight - top - bottomPadding),
                ),
            );
        };

        measure();
        window.addEventListener('resize', measure);
        // The toolbar above can change height after the first paint (fonts, wrapping).
        const observer = new ResizeObserver(measure);
        const main = ref.current?.closest('main');

        if (main) {
            observer.observe(main);
        }

        return () => {
            window.removeEventListener('resize', measure);
            observer.disconnect();
        };
    }, []);

    return [ref, height ?? 'calc(100svh - 13rem)'];
}

/**
 * Week/day calendar (FullCalendar time grid). Entries are local wall-clock strings, so the calendar
 * runs in "UTC" mode and shows them as-is in the user's time zone.
 */
export function TimeCalendar({
    view,
    date,
    weekStartsOn,
    now,
    entries,
    onSelect,
    onEdit,
    onChange,
}: Props) {
    const { t, locale, intlLocale } = useTranslation();
    const [containerRef, height] = useFillHeight();
    const calendarRef = useRef<CalendarRef>(null);
    const selection = useRef<'idle' | 'selecting' | 'cancelled'>('idle');

    useLayoutEffect(() => {
        const cancelSelection = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || selection.current !== 'selecting') {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            selection.current = 'cancelled';
            calendarRef.current?.getApi().unselect();
        };

        // FullCalendar commits on mouseup or touchend before the event reaches window.
        const finishSelection = () => {
            selection.current = 'idle';
        };

        const listeners = new AbortController();
        const { signal } = listeners;
        window.addEventListener('keydown', cancelSelection, {
            capture: true,
            signal,
        });
        window.addEventListener('mouseup', finishSelection, { signal });
        window.addEventListener('touchend', finishSelection, { signal });
        window.addEventListener('touchcancel', finishSelection, { signal });

        return () => listeners.abort();
    }, []);

    const byId = new Map(entries.map((entry) => [String(entry.id), entry]));
    const dayTotal = (day: string) =>
        entries
            .filter((entry) => entry.date === day)
            .reduce((sum, entry) => sum + entry.durationSeconds, 0);

    return (
        <div
            ref={containerRef}
            className="time-calendar overflow-hidden rounded-2xl bg-surface shadow-surface"
            data-view={view}
        >
            <FullCalendar
                ref={calendarRef}
                key={`${view}-${date}`}
                plugins={[timeGridPlugin, interactionPlugin, classicTheme]}
                initialView={view === 'week' ? 'timeGridWeek' : 'timeGridDay'}
                initialDate={date}
                timeZone="UTC"
                now={`${now}:00Z`}
                locales={[svLocale]}
                locale={locale === 'sv' ? 'sv' : 'en-gb'}
                firstDay={weekStartsOn % 7}
                headerToolbar={false}
                // The day view's date and total are in the page header above.
                dayHeaders={view === 'week'}
                borderless
                allDaySlot={false}
                nowIndicator
                height={height}
                scrollTime="07:00:00"
                slotDuration="00:30:00"
                snapDuration="00:15:00"
                slotHeaderFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                }}
                eventTimeFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                }}
                selectable
                selectMirror
                selectAllow={() => {
                    if (selection.current === 'cancelled') {
                        return false;
                    }

                    selection.current = 'selecting';

                    return true;
                }}
                editable
                eventMinHeight={28}
                eventShortHeight={42}
                eventResizableFromStart
                events={entries.map((entry) => ({
                    id: String(entry.id),
                    title: entry.project.name,
                    start: `${entry.start}:00Z`,
                    end: `${entry.end}:00Z`,
                    // Drawn by eventContent as a soft card in the project colour.
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    extendedProps: {
                        description: entry.description,
                        color: entry.project.color,
                        tags: entry.tags,
                        isBillable: entry.isBillable,
                    },
                }))}
                eventClass="time-calendar-event"
                slotHeaderClass="time-calendar-slot-label"
                dayHeaderClass="time-calendar-day-header"
                nowIndicatorLineClass="time-calendar-now"
                dayHeaderContent={(info) => {
                    const day = fromCalendarDate(info.date).slice(0, 10);

                    return (
                        <span className="flex flex-col items-center gap-0.5 py-2">
                            <span className="text-xs text-muted first-letter:uppercase">
                                {formatDate(day, intlLocale, {
                                    weekday: 'short',
                                })}
                            </span>
                            <span
                                className={`flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${info.isToday ? 'bg-accent text-accent-foreground' : ''}`}
                            >
                                {formatDate(day, intlLocale, {
                                    day: 'numeric',
                                })}
                            </span>
                            <span className="text-xs text-muted tabular-nums">
                                {formatDuration(dayTotal(day))}
                            </span>
                        </span>
                    );
                }}
                eventContent={(info) => {
                    const color = String(info.event.extendedProps.color);
                    // The selection mirror (dragging out a new entry) has no extendedProps.
                    const tags =
                        (info.event.extendedProps.tags as
                            | string[]
                            | undefined) ?? [];
                    const isBillable =
                        info.event.extendedProps.isBillable === true;
                    const contentSpacing = isBillable
                        ? info.isShort
                            ? 'pl-5'
                            : 'mb-3.5'
                        : '';

                    return (
                        <div
                            className="relative flex h-full w-full flex-col overflow-hidden rounded-lg border-l-[3px] px-2 py-0.5 text-xs leading-tight text-foreground"
                            style={{
                                borderLeftColor: color,
                                backgroundColor: `color-mix(in oklab, ${color} 18%, var(--surface))`,
                            }}
                        >
                            <div
                                className={`min-h-0 flex-1 overflow-hidden ${contentSpacing}`}
                            >
                                <div className="truncate font-semibold">
                                    {info.event.title}
                                </div>
                                {info.event.extendedProps.description && (
                                    <div className="truncate text-muted">
                                        {String(
                                            info.event.extendedProps
                                                .description,
                                        )}
                                    </div>
                                )}
                                <div className="text-muted tabular-nums">
                                    {info.event.start &&
                                        timeOf(
                                            fromCalendarDate(info.event.start),
                                        )}
                                    –
                                    {info.event.end &&
                                        timeOf(
                                            fromCalendarDate(info.event.end),
                                        )}
                                </div>
                                {tags.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="max-w-full truncate rounded-full bg-surface/70 px-1.5 py-px text-[0.6875rem] text-foreground"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {isBillable && (
                                <Banknote
                                    role="img"
                                    aria-label={t('Billable')}
                                    className="absolute bottom-0.5 left-2 size-3.5"
                                    style={{ color }}
                                />
                            )}
                        </div>
                    );
                }}
                select={(info) => {
                    // FullCalendar can still report the last range when released without moving.
                    if (selection.current === 'cancelled') {
                        return;
                    }

                    calendarRef.current?.getApi().unselect();
                    onSelect(
                        fromCalendarDate(info.start),
                        fromCalendarDate(info.end),
                    );
                }}
                eventClick={(info) => {
                    const entry = byId.get(info.event.id);

                    if (entry) {
                        onEdit(entry);
                    }
                }}
                eventDrop={(info) => {
                    const entry = byId.get(info.event.id);

                    if (entry && info.event.start && info.event.end) {
                        onChange(
                            entry,
                            fromCalendarDate(info.event.start),
                            fromCalendarDate(info.event.end),
                            info.revert,
                        );
                    }
                }}
                eventResize={(info) => {
                    const entry = byId.get(info.event.id);

                    if (entry && info.event.start && info.event.end) {
                        onChange(
                            entry,
                            fromCalendarDate(info.event.start),
                            fromCalendarDate(info.event.end),
                            info.revert,
                        );
                    }
                }}
            />
        </div>
    );
}
