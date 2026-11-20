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
import { Temporal } from 'temporal-polyfill';
import { useTranslation } from '@/lib/i18n';
import {
    formatDate,
    formatDuration,
    fromCalendarDate,
    timeOf,
} from '@/lib/time';
import { cn } from '@/lib/utils';
import type { TimeEntry } from '@/types';

type Props = {
    view: 'week' | 'day';
    date: string;
    weekStartsOn: number;
    timezone: string;
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
 * keeps it clear of the bottom navigation, so the page itself never scrolls. The returned height is
 * for the calendar inside the element, so the element's own border is left out of it.
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
            const { borderTopWidth, borderBottomWidth } =
                getComputedStyle(element);
            const borders =
                Number.parseFloat(borderTopWidth) +
                Number.parseFloat(borderBottomWidth);

            setHeight(
                Math.max(
                    240,
                    Math.floor(
                        window.innerHeight - top - bottomPadding - borders,
                    ),
                ),
            );
        };

        measure();
        const listeners = new AbortController();
        window.addEventListener('resize', measure, {
            signal: listeners.signal,
        });
        // The toolbar above can change height after the first paint (fonts, wrapping).
        const observer = new ResizeObserver(measure);
        const main = ref.current?.closest('main');

        if (main) {
            observer.observe(main);
            // The content area slides in on the first load, which offsets the first measurement.
            main.addEventListener('animationend', measure, {
                signal: listeners.signal,
            });
        }

        return () => {
            listeners.abort();
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
    timezone,
    entries,
    onSelect,
    onEdit,
    onChange,
}: Props) {
    const { t, locale, intlLocale } = useTranslation();
    const [containerRef, height] = useFillHeight();
    const calendarRef = useRef<CalendarRef>(null);
    const resizeLane = useRef<HTMLElement | null>(null);
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
            className="time-calendar overflow-hidden rounded-2xl border border-separator bg-surface"
            data-view={view}
        >
            <FullCalendar
                ref={calendarRef}
                key={`${view}-${date}`}
                plugins={[timeGridPlugin, interactionPlugin, classicTheme]}
                initialView={view === 'week' ? 'timeGridWeek' : 'timeGridDay'}
                initialDate={date}
                timeZone="UTC"
                now={() =>
                    `${Temporal.Now.plainDateTimeISO(timezone).toString({ smallestUnit: 'second' })}Z`
                }
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
                // Leave space above 07:00 for its label to straddle the grid line.
                scrollTime="06:30:00"
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
                eventMinHeight={0}
                eventResizableFromStart
                events={entries.map((entry) => ({
                    id: String(entry.id),
                    title: entry.project.name,
                    start: `${entry.start}:00Z`,
                    end: `${entry.end}:00Z`,
                    color: entry.project.color,
                }))}
                eventClass={({ isMirror, isResizing }) =>
                    cn(
                        'time-calendar-event',
                        isMirror && 'time-calendar-event-mirror',
                        isMirror &&
                            isResizing &&
                            'time-calendar-resize-preview',
                    )
                }
                eventBeforeClass={(info) =>
                    info.isStartResizable &&
                    !info.isSelected &&
                    'time-calendar-resizer time-calendar-resizer-start'
                }
                eventAfterClass={(info) =>
                    info.isEndResizable &&
                    !info.isSelected &&
                    'time-calendar-resizer time-calendar-resizer-end'
                }
                slotLaneClass={(info) =>
                    info.isMinor && 'time-calendar-slot-minor'
                }
                dayLaneClass={({ dow }) =>
                    dow === 0 || dow === 6
                        ? 'time-calendar-day time-calendar-weekend'
                        : 'time-calendar-day'
                }
                dayLaneInnerClass={({ isStack, isNarrow }) =>
                    !isStack &&
                    (isNarrow
                        ? 'time-calendar-event-lane time-calendar-event-lane-narrow'
                        : 'time-calendar-event-lane')
                }
                slotHeaderClass="time-calendar-slot-label"
                slotHeaderInnerClass={({ isFirst }) =>
                    isFirst
                        ? 'time-calendar-slot-label-text'
                        : 'time-calendar-slot-label-text time-calendar-slot-label-text-aligned'
                }
                dayHeaderClass="time-calendar-day-header"
                nowIndicatorLineClass="time-calendar-now"
                dayHeaderContent={(info) => {
                    const day = fromCalendarDate(info.date).slice(0, 10);

                    return (
                        <span className="flex flex-col items-center gap-1 py-1.5">
                            <span className="text-xs font-medium text-muted first-letter:uppercase">
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
                            <span className="text-[11px] font-medium text-muted tabular-nums">
                                {formatDuration(dayTotal(day))}
                            </span>
                        </span>
                    );
                }}
                eventContent={(info) => {
                    const { id, title, start, end } = info.event;
                    // The selection preview has dates but no saved entry.
                    const entry = byId.get(id);
                    const color = entry?.project.color ?? 'var(--accent)';
                    const localStart = start && fromCalendarDate(start);
                    const localEnd = end && fromCalendarDate(end);
                    const range =
                        localStart && localEnd
                            ? `${timeOf(localStart)} – ${timeOf(localEnd)}`
                            : '';
                    // Use the saved duration, including across DST changes. While resizing,
                    // FullCalendar's preview has updated wall-clock times.
                    const durationSeconds =
                        entry &&
                        entry.start === localStart &&
                        entry.end === localEnd
                            ? entry.durationSeconds
                            : start && end
                              ? (end.getTime() - start.getTime()) / 1000
                              : null;
                    const duration =
                        durationSeconds === null
                            ? ''
                            : formatDuration(durationSeconds);

                    return (
                        <div
                            className="time-calendar-entry relative size-full overflow-hidden border-l-3 text-xs leading-tight text-foreground"
                            style={{
                                borderLeftColor: color,
                                backgroundColor: `color-mix(in oklab, ${color} 14%, var(--surface))`,
                            }}
                            title={[title, range, duration]
                                .filter(Boolean)
                                .join(' · ')}
                        >
                            <div className="time-calendar-entry-layout flex size-full flex-col p-2">
                                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
                                    <div className="shrink-0 truncate font-semibold">
                                        {title || range}
                                    </div>
                                    {entry?.description && (
                                        <div className="time-calendar-entry-detail shrink-0 truncate text-[11px]/3.5 text-muted">
                                            {entry.description}
                                        </div>
                                    )}
                                    {title && range && (
                                        <div className="time-calendar-entry-range shrink-0 truncate text-[11px]/3.5 font-medium text-muted tabular-nums">
                                            {range}
                                        </div>
                                    )}
                                    {!!entry?.tags.length && (
                                        <div className="time-calendar-entry-detail flex shrink-0 flex-wrap gap-1">
                                            {entry.tags.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="max-w-full truncate rounded-full px-1.5 py-px text-[10px]/3 font-medium"
                                                    style={{
                                                        backgroundColor: `color-mix(in oklab, ${color} 20%, transparent)`,
                                                    }}
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex h-3.5 shrink-0 items-center justify-end gap-0.5 text-[11px]/3.5 font-medium text-muted tabular-nums">
                                    {entry?.isBillable && (
                                        <Banknote
                                            role="img"
                                            aria-label={t('Billable')}
                                            size={14}
                                            className="time-calendar-entry-icon absolute shrink-0"
                                            style={{ color }}
                                        />
                                    )}
                                    {duration}
                                </div>
                            </div>
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
                eventResizeStart={({ el }) => {
                    const wrapper = el.parentElement;
                    const lane = el.closest<HTMLElement>('[data-date]');

                    if (wrapper && lane) {
                        // The preview can first appear after the pointer has already crossed a slot.
                        lane.style.setProperty(
                            '--resize-origin-top',
                            wrapper.style.top,
                        );
                        lane.style.setProperty(
                            '--resize-origin-height',
                            wrapper.style.height,
                        );
                        resizeLane.current = lane;
                    }
                }}
                eventResizeStop={() => {
                    resizeLane.current?.style.removeProperty(
                        '--resize-origin-top',
                    );
                    resizeLane.current?.style.removeProperty(
                        '--resize-origin-height',
                    );
                    resizeLane.current = null;
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
