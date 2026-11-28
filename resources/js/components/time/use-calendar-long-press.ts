import { useEffectEvent, useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import type { CalendarRef } from '@fullcalendar/react';
import type { CalendarApiImpl } from '@fullcalendar/react/protected-api';
import { isAndroidTouch, vibrateLightly } from '@/lib/haptics';
import { addDays, minutesToTime, timeToMinutes } from '@/lib/time';

export const CALENDAR_SNAP_MINUTES = 15;
export const CALENDAR_TOUCH_MOVE_TOLERANCE = 8;

const HOLD_DELAY = 500;
const BLOCK_MINUTES = 60;
const DAY_MINUTES = 24 * 60;

function rangeAtTouch(calendar: HTMLElement, { clientX, clientY }: Touch) {
    const layers = document.elementsFromPoint(clientX, clientY);
    const lane = layers[0]?.closest<HTMLElement>('.time-calendar-day');
    const day = lane?.dataset.date;
    if (!day || !calendar.contains(lane)) {
        return null;
    }

    // The time rows are underneath the day columns in FullCalendar's time grid.
    const slot = layers.find(
        (layer): layer is HTMLElement =>
            layer instanceof HTMLElement &&
            layer.classList.contains('time-calendar-slot') &&
            calendar.contains(layer),
    );
    if (!slot?.dataset.time) {
        return null;
    }

    const { top, height } = slot.getBoundingClientRect();
    const slotMinute = timeToMinutes(slot.dataset.time);
    const centerMinute =
        clientY < top + height / 2
            ? slotMinute
            : slotMinute + CALENDAR_SNAP_MINUTES;
    const startMinute = Math.min(
        Math.max(0, centerMinute - BLOCK_MINUTES / 2),
        DAY_MINUTES - BLOCK_MINUTES,
    );
    const endMinute = startMinute + BLOCK_MINUTES;
    const endDay = endMinute === DAY_MINUTES ? addDays(day, 1) : day;

    return {
        start: `${day}T${minutesToTime(startMinute)}`,
        end: `${endDay}T${minutesToTime(endMinute)}`,
    };
}

type Press = {
    origin: Touch;
    timeout: number;
    active: boolean;
    range: ReturnType<typeof rangeAtTouch>;
};

export function useCalendarLongPress(
    containerRef: RefObject<HTMLDivElement | null>,
    calendarRef: RefObject<CalendarRef | null>,
    calendarKey: string,
    enabled: boolean,
    onSelect: (start: string, end: string) => void,
) {
    const reportTime = useEffectEvent(onSelect);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container || !enabled) {
            return;
        }

        const api = calendarRef.current?.getApi() as
            | CalendarApiImpl
            | undefined;
        let press: Press | null = null;
        let touchId: number | null = null;

        function unselectEvent() {
            // CalendarApi.unselect() only clears date ranges, including the form's draft.
            if (api?.getCurrentData().eventSelection) {
                api.dispatch({ type: 'UNSELECT_EVENT' });
            }
        }

        function preview(touch: Touch, withHaptics = true) {
            if (!container || !press) return;

            const range = rangeAtTouch(container, touch);
            if (range?.start === press.range?.start) return;

            press.range = range;
            if (range) {
                if (withHaptics && isAndroidTouch(true)) vibrateLightly();
                api?.select(`${range.start}:00Z`, `${range.end}:00Z`);
            } else {
                api?.unselect();
            }
        }

        function finish(keepPreview = false) {
            if (!press) return;

            window.clearTimeout(press.timeout);
            if (press.active) {
                container?.removeAttribute('data-calendar-editing');
                if (!keepPreview) api?.unselect();
            }
            press = null;
        }

        function start(event: TouchEvent) {
            const { target, touches } = event;
            if (
                touches.length !== 1 ||
                !(target instanceof Element) ||
                !container ||
                target.closest(
                    '.time-calendar-event, a, button, [role="button"]',
                ) ||
                container.closest('[data-swiping]') ||
                !rangeAtTouch(container, touches[0])
            ) {
                return;
            }

            // Take only empty timed cells. Swipe navigation has already seen the
            // touch in capture, while FullCalendar still handles entries and all-day cells.
            event.stopPropagation();
            const origin = touches[0];
            touchId = origin.identifier;
            press = {
                origin,
                active: false,
                range: null,
                timeout: window.setTimeout(() => {
                    if (!press || container.closest('[data-swiping]')) return;

                    unselectEvent();
                    press.active = true;
                    container.setAttribute('data-calendar-editing', '');
                    preview(origin);
                }, HOLD_DELAY),
            };
        }

        function move(event: TouchEvent) {
            if (!press) return;

            const touch = Array.from(event.touches).find(
                ({ identifier }) => identifier === touchId,
            );
            if (!touch) return;

            if (press.active) {
                preview(touch);
                if (event.cancelable) event.preventDefault();
            } else if (
                Math.max(
                    Math.abs(touch.clientX - press.origin.clientX),
                    Math.abs(touch.clientY - press.origin.clientY),
                ) >= CALENDAR_TOUCH_MOVE_TOLERANCE
            ) {
                finish();
            }
        }

        function end(event: TouchEvent) {
            const touch = Array.from(event.changedTouches).find(
                ({ identifier }) => identifier === touchId,
            );
            if (!touch) return;

            touchId = null;
            if (press?.active) {
                preview(touch, false);
            } else if (press) {
                // We also suppress the synthetic click for taps on empty timed cells.
                unselectEvent();
            }

            const range = press?.range;
            // FullCalendar did not see this touch start. Suppress its emulated mouse events.
            if (event.cancelable) event.preventDefault();
            finish(Boolean(range));
            if (!range) return;

            if (isAndroidTouch(true)) vibrateLightly();
            reportTime(range.start, range.end);
        }

        const listeners = new AbortController();
        const { signal } = listeners;
        window.addEventListener(
            'click',
            ({ target }) => {
                if (
                    target instanceof Element &&
                    !target.closest('.time-calendar-event-touch-selected')
                ) {
                    unselectEvent();
                }
            },
            { capture: true, signal },
        );
        container.addEventListener('touchstart', start, {
            capture: true,
            passive: true,
            signal,
        });
        container.addEventListener('touchmove', move, {
            capture: true,
            passive: false,
            signal,
        });
        container.addEventListener('touchend', end, { passive: false, signal });
        container.addEventListener(
            'touchcancel',
            () => {
                touchId = null;
                finish();
            },
            { signal },
        );
        container.addEventListener(
            'contextmenu',
            (event) => {
                if (press) event.preventDefault();
            },
            { signal },
        );
        window.addEventListener(
            'touchstart',
            (event) => {
                if (event.touches.length > 1) finish();
            },
            { capture: true, passive: true, signal },
        );
        window.addEventListener(
            'scroll',
            () => {
                if (!press?.active) finish();
            },
            { capture: true, passive: true, signal },
        );
        window.addEventListener('blur', () => finish(), { signal });
        window.addEventListener(
            'keydown',
            (event) => {
                if (event.key !== 'Escape' || !press?.active) return;

                event.preventDefault();
                event.stopPropagation();
                finish();
            },
            { capture: true, signal },
        );

        return () => {
            listeners.abort();
            finish();
        };
    }, [containerRef, calendarRef, calendarKey, enabled]);
}
