import FullCalendar from '@fullcalendar/react';
import type { CalendarRef } from '@fullcalendar/react';
import interactionPlugin from '@fullcalendar/react/interaction';
import svLocale from '@fullcalendar/react/locales/sv';
import classicTheme from '@fullcalendar/react/themes/classic';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import { Tooltip } from '@heroui/react';
import { Banknote, CalendarDays, CalendarOff } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Temporal } from 'temporal-polyfill';
import { formatHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import {
    addDays,
    formatDate,
    formatDuration,
    fromCalendarDate,
    timeOf,
} from '@/lib/time';
import { cn } from '@/lib/utils';
import type {
    Absence,
    CalendarHoliday,
    ColleagueOff,
    RunningTimer,
    TimeEntry,
} from '@/types';

const TIMER_EVENT_ID = 'running-timer';

/**
 * Where the running timer's event ends: now (local wall-clock time), at least 15 minutes after the
 * start so a timer that just started is visible. Updated every 30 seconds.
 */
function useTimerEnd(
    timer: RunningTimer | null,
    timezone: string,
): string | null {
    const [now, setNow] = useState(() =>
        Temporal.Now.plainDateTimeISO(timezone),
    );

    useLayoutEffect(() => {
        if (!timer) {
            return;
        }

        const interval = window.setInterval(
            () => setNow(Temporal.Now.plainDateTimeISO(timezone)),
            30000,
        );

        return () => window.clearInterval(interval);
    }, [timer, timezone]);

    if (!timer) {
        return null;
    }

    const minimum = Temporal.PlainDateTime.from(timer.start).add({
        minutes: 15,
    });
    const end =
        Temporal.PlainDateTime.compare(now, minimum) > 0 ? now : minimum;

    return end.toString({ smallestUnit: 'minute' });
}

type Props = {
    view: 'week' | 'day';
    date: string;
    weekStartsOn: number;
    timezone: string;
    entries: TimeEntry[];
    holidays: CalendarHoliday[];
    /** The shown member's absence, in the all-day row. */
    absences: Absence[];
    /** Colleagues' absence, shown as "Off · name". */
    colleaguesOff: ColleagueOff[];
    floatingAction?: ReactNode;
    hasSelectionDraft: boolean;
    /** Drag on an empty slot. */
    onSelect: (start: string, end: string) => void;
    /** Drag across days in the all-day row; the first and last day. */
    onSelectDays: (startsOn: string, endsOn: string) => void;
    onEdit: (entry: TimeEntry) => void;
    onEditAbsence: (absence: Absence) => void;
    /** The viewer's running timer, shown from its start to now. */
    timer?: RunningTimer | null;
    onEditTimer?: () => void;
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
    holidays,
    absences,
    colleaguesOff,
    floatingAction,
    hasSelectionDraft,
    onSelect,
    onSelectDays,
    onEdit,
    onEditAbsence,
    timer,
    onEditTimer,
    onChange,
}: Props) {
    const { t, locale, intlLocale } = useTranslation();
    const timerEnd = useTimerEnd(timer ?? null, timezone);
    const [containerRef, height] = useFillHeight();
    const calendarRef = useRef<CalendarRef>(null);
    const resizeLane = useRef<HTMLElement | null>(null);
    const selection = useRef<'idle' | 'selecting' | 'cancelled'>('idle');
    const [dayLanes, setDayLanes] = useState<HTMLElement[]>([]);

    useLayoutEffect(() => {
        if (!hasSelectionDraft) {
            calendarRef.current?.getApi().unselect();
        }
    }, [hasSelectionDraft]);

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
    const holidayByDate = new Map(
        holidays.map(({ date, name }) => [date, name]),
    );
    const absenceById = new Map(
        absences.map((absence) => [`absence-${absence.id}`, absence]),
    );
    // Both absence lists cover the whole week, even when the calendar shows one day.
    const showAbsenceRow = [...absences, ...colleaguesOff].some(
        ({ startsOn, endsOn }) =>
            view === 'week' || (startsOn <= date && date <= endsOn),
    );
    const absenceLabel = t('Absence');
    const absenceTitle = (absence: Absence) =>
        absence.secondsPerDay === null
            ? absence.label
            : `${absence.label} · ${formatHours(absence.secondsPerDay, intlLocale)}`;
    const dayTotal = (day: string) =>
        entries
            .filter((entry) => entry.date === day)
            .reduce((sum, entry) => sum + entry.durationSeconds, 0);

    return (
        <div
            ref={containerRef}
            className="time-calendar relative overflow-hidden rounded-2xl border border-separator bg-surface"
            data-view={view}
            data-holidays={holidays.length > 0 || undefined}
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
                allDaySlot={showAbsenceRow}
                allDayHeaderClass="items-center justify-center"
                allDayHeaderContent={() => (
                    <Tooltip delay={350} closeDelay={0}>
                        <Tooltip.Trigger
                            role="img"
                            tabIndex={0}
                            aria-label={absenceLabel}
                            className="grid size-6 place-items-center rounded-sm text-muted outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                            <CalendarOff
                                aria-hidden="true"
                                className="size-4"
                            />
                        </Tooltip.Trigger>
                        <Tooltip.Content placement="right" showArrow>
                            <Tooltip.Arrow />
                            {absenceLabel}
                        </Tooltip.Content>
                    </Tooltip>
                )}
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
                // The dialog owns the selection until it closes.
                unselectAuto={false}
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
                events={[
                    ...entries.map((entry) => ({
                        id: String(entry.id),
                        title: entry.project.name,
                        start: `${entry.start}:00Z`,
                        end: `${entry.end}:00Z`,
                        color: entry.project.color,
                    })),
                    // All-day events end on the day after their last day.
                    ...absences.map((absence) => ({
                        id: `absence-${absence.id}`,
                        title: absenceTitle(absence),
                        start: absence.startsOn,
                        end: addDays(absence.endsOn, 1),
                        allDay: true,
                        editable: false,
                        color: 'transparent',
                    })),
                    ...(timer && timerEnd
                        ? [
                              {
                                  id: TIMER_EVENT_ID,
                                  title:
                                      timer.project?.name ??
                                      t('No project yet'),
                                  start: `${timer.start}:00Z`,
                                  end: `${timerEnd}:00Z`,
                                  editable: false,
                                  color: 'transparent',
                              },
                          ]
                        : []),
                    ...colleaguesOff.map((off) => ({
                        id: `off-${off.id}`,
                        title: t('Off · :name', { name: off.name }),
                        start: off.startsOn,
                        end: addDays(off.endsOn, 1),
                        allDay: true,
                        editable: false,
                        color: 'transparent',
                    })),
                ]}
                eventClass={({ event, isMirror, isDragging, isResizing }) =>
                    event.allDay
                        ? 'time-calendar-absence'
                        : cn(
                              'time-calendar-event',
                              isMirror && 'time-calendar-event-mirror',
                              isMirror &&
                                  isDragging &&
                                  'time-calendar-move-preview',
                              isMirror &&
                                  isResizing &&
                                  'time-calendar-resize-preview',
                          )
                }
                eventInnerClass="time-calendar-event-inner"
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
                    cn(
                        info.isMinor && 'time-calendar-slot-minor',
                        holidays.length > 0 &&
                            info.time?.milliseconds === 0 &&
                            'time-calendar-slot-midnight',
                    )
                }
                tableBodyClass="time-calendar-body"
                dayLaneClass={({ dow }) =>
                    dow === 0 || dow === 6
                        ? 'time-calendar-day time-calendar-weekend'
                        : 'time-calendar-day'
                }
                dayLaneDidMount={({ el }) =>
                    setDayLanes((lanes) => [...lanes, el])
                }
                dayLaneWillUnmount={({ el }) =>
                    setDayLanes((lanes) => lanes.filter((lane) => lane !== el))
                }
                dayLaneInnerClass={({ isStack, isNarrow }) =>
                    !isStack &&
                    (isNarrow
                        ? 'time-calendar-event-lane time-calendar-event-lane-narrow'
                        : 'time-calendar-event-lane')
                }
                slotHeaderClass="time-calendar-slot-label"
                slotHeaderInnerClass={({ isFirst }) =>
                    cn(
                        'time-calendar-slot-label-text',
                        (!isFirst || holidays.length > 0) &&
                            'time-calendar-slot-label-text-aligned',
                    )
                }
                dayHeaderClass="time-calendar-day-header"
                nowIndicatorHeaderClass="time-calendar-now-arrow"
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

                    if (id === TIMER_EVENT_ID && timer) {
                        return (
                            <div
                                className="time-calendar-entry time-calendar-timer relative size-full cursor-pointer overflow-hidden rounded-[inherit] border border-transparent bg-accent-soft p-2 text-xs leading-tight text-foreground"
                                data-test="calendar-timer"
                            >
                                <div className="truncate font-semibold">
                                    {title}
                                </div>
                                <div className="truncate text-[11px]/3.5 font-medium text-accent">
                                    {t(':start – now · running', {
                                        start: timeOf(timer.start),
                                    })}
                                </div>
                            </div>
                        );
                    }

                    if (info.event.allDay) {
                        const isOwn = absenceById.has(id);

                        return (
                            <div
                                className={cn(
                                    'w-full truncate rounded-md px-2 py-0.5 text-xs/4.5 font-medium',
                                    isOwn
                                        ? 'cursor-pointer border-l-3 border-warning bg-warning-soft text-warning-soft-foreground'
                                        : 'bg-default text-muted',
                                )}
                                data-test={
                                    isOwn ? 'calendar-absence' : 'calendar-off'
                                }
                            >
                                {title}
                            </div>
                        );
                    }

                    // The selection preview has dates but no saved entry.
                    const entry = byId.get(id);
                    const color = entry?.project.color ?? 'var(--accent)';
                    const localStart = start && fromCalendarDate(start);
                    const localEnd = end && fromCalendarDate(end);
                    const startTime = localStart ? timeOf(localStart) : '';
                    const endTime = localEnd ? timeOf(localEnd) : '';
                    const range =
                        startTime && endTime ? `${startTime} – ${endTime}` : '';
                    const resizingEntry =
                        info.isMirror && info.isResizing ? entry : undefined;
                    const startChanged =
                        resizingEntry && resizingEntry.start !== localStart;
                    const endChanged =
                        resizingEntry && resizingEntry.end !== localEnd;
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
                        >
                            <div className="time-calendar-entry-layout flex size-full flex-col p-2">
                                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
                                    <div className="shrink-0 truncate font-semibold">
                                        {title || range}
                                    </div>
                                    {entry?.description && (
                                        <div className="time-calendar-entry-detail min-h-3.5">
                                            <div className="max-h-[round(down,100%,1lh)] overflow-hidden text-[11px]/3.5 wrap-anywhere whitespace-pre-wrap text-muted">
                                                {entry.description}
                                            </div>
                                        </div>
                                    )}
                                    {title && range && (
                                        <div className="time-calendar-entry-range shrink-0 truncate text-[11px]/3.5 font-medium text-muted tabular-nums">
                                            <span
                                                className={
                                                    startChanged
                                                        ? 'font-semibold'
                                                        : undefined
                                                }
                                            >
                                                {startTime}
                                            </span>
                                            {' – '}
                                            <span
                                                className={
                                                    endChanged
                                                        ? 'font-semibold'
                                                        : undefined
                                                }
                                            >
                                                {endTime}
                                            </span>
                                        </div>
                                    )}
                                    {!!entry?.tags.length && (
                                        <div className="time-calendar-entry-detail mt-0.5 flex shrink-0 flex-wrap gap-1">
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

                    if (info.allDay) {
                        calendarRef.current?.getApi().unselect();
                        onSelectDays(
                            fromCalendarDate(info.start).slice(0, 10),
                            addDays(
                                fromCalendarDate(info.end).slice(0, 10),
                                -1,
                            ),
                        );

                        return;
                    }

                    onSelect(
                        fromCalendarDate(info.start),
                        fromCalendarDate(info.end),
                    );
                }}
                eventClick={(info) => {
                    if (info.event.id === TIMER_EVENT_ID) {
                        onEditTimer?.();

                        return;
                    }

                    const absence = absenceById.get(info.event.id);

                    if (absence) {
                        onEditAbsence(absence);

                        return;
                    }

                    const entry = byId.get(info.event.id);

                    if (entry) {
                        onEdit(entry);
                    }
                }}
                eventDragStart={({ el }) => {
                    const lane = el.closest('.time-calendar-event-lane');
                    const calendar = containerRef.current;

                    if (lane && calendar) {
                        const { left, width } = el.getBoundingClientRect();
                        const { paddingInline } = getComputedStyle(el);
                        const offset = left - lane.getBoundingClientRect().left;

                        calendar.style.setProperty(
                            '--move-origin-left',
                            `${offset}px`,
                        );
                        calendar.style.setProperty(
                            '--move-origin-width',
                            `${width}px`,
                        );
                        calendar.style.setProperty(
                            '--move-origin-padding',
                            paddingInline,
                        );
                        // FullCalendar clones this element when dragging outside the grid.
                        el.style.setProperty(
                            '--time-calendar-entry-padding',
                            paddingInline,
                        );
                    }
                }}
                eventDragStop={({ el }) => {
                    const style = containerRef.current?.style;
                    style?.removeProperty('--move-origin-left');
                    style?.removeProperty('--move-origin-width');
                    style?.removeProperty('--move-origin-padding');
                    el.style.removeProperty('--time-calendar-entry-padding');
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
            {dayLanes.map((lane) => {
                const name = holidayByDate.get(lane.dataset.date ?? '');

                return name
                    ? createPortal(
                          <div
                              className="time-calendar-holiday pointer-events-none mx-1 flex h-5 items-center gap-1 overflow-hidden rounded-xl px-2 text-[11px]/3.5 font-medium text-danger-soft-foreground"
                              data-test="calendar-holiday"
                          >
                              <CalendarDays
                                  aria-hidden="true"
                                  className="size-2.75 shrink-0"
                              />
                              <span className="truncate">{name}</span>
                          </div>,
                          lane,
                          lane.dataset.date,
                      )
                    : null;
            })}
            {floatingAction && (
                <div className="absolute end-4 bottom-4 z-10 flex">
                    {floatingAction}
                </div>
            )}
        </div>
    );
}
