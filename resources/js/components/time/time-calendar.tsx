import FullCalendar from '@fullcalendar/react';
import interactionPlugin from '@fullcalendar/react/interaction';
import svLocale from '@fullcalendar/react/locales/sv';
import classicTheme from '@fullcalendar/react/themes/classic';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import { useLayoutEffect, useRef, useState } from 'react';
import { useIsDesktop } from '@/hooks/use-media-query';
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

/** Space kept below the calendar on desktop: the content area's bottom padding (md:pb-12). */
const BOTTOM_GAP = 48;

/**
 * Fills the viewport below the calendar's top edge on desktop, so it uses all available height
 * whatever the toolbar above it wraps to. Mobile keeps a fixed offset for the bottom navigation.
 */
function useFillHeight(): [
    React.RefObject<HTMLDivElement | null>,
    number | string,
] {
    const ref = useRef<HTMLDivElement>(null);
    const isDesktop = useIsDesktop();
    const [height, setHeight] = useState<number | null>(null);

    useLayoutEffect(() => {
        if (!isDesktop) {
            return;
        }

        const measure = () => {
            const top =
                (ref.current?.getBoundingClientRect().top ?? 0) +
                window.scrollY;
            setHeight(
                Math.max(
                    480,
                    Math.floor(window.innerHeight - top - BOTTOM_GAP),
                ),
            );
        };

        measure();
        window.addEventListener('resize', measure);

        return () => window.removeEventListener('resize', measure);
    }, [isDesktop]);

    return [
        ref,
        isDesktop && height !== null ? height : 'calc(100svh - 13rem)',
    ];
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
    const { locale, intlLocale } = useTranslation();
    const [containerRef, height] = useFillHeight();
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
                editable
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

                    return (
                        <div
                            className="h-full overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-xs leading-tight text-foreground"
                            style={{
                                borderLeftColor: color,
                                backgroundColor: `color-mix(in oklab, ${color} 18%, var(--surface))`,
                            }}
                        >
                            <div className="truncate font-semibold">
                                {info.event.title}
                            </div>
                            {info.event.extendedProps.description && (
                                <div className="truncate text-muted">
                                    {String(
                                        info.event.extendedProps.description,
                                    )}
                                </div>
                            )}
                            <div className="text-muted tabular-nums">
                                {info.event.start &&
                                    timeOf(fromCalendarDate(info.event.start))}
                                –
                                {info.event.end &&
                                    timeOf(fromCalendarDate(info.event.end))}
                            </div>
                        </div>
                    );
                }}
                select={(info) =>
                    onSelect(
                        fromCalendarDate(info.start),
                        fromCalendarDate(info.end),
                    )
                }
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
