import type { CalendarRef, EventClickInfo } from '@fullcalendar/react';
import { getElEventRange } from '@fullcalendar/react/protected-api';
import type { CalendarApiImpl } from '@fullcalendar/react/protected-api';
import { useCallback, useEffectEvent, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { CALENDAR_TOUCH_MOVE_TOLERANCE } from './use-calendar-long-press';

export const CALENDAR_EVENT_LONG_PRESS_DELAY = 400;
const EVENT_SELECTION_TIMEOUT = 5000;
const RESIZE_HANDLE = '.time-calendar-resizer';
const TIME_EVENT = '.time-calendar-event';
const SELECTED_EVENT = '.time-calendar-event-touch-selected';

export function useCalendarEventSelection(
    containerRef: RefObject<HTMLDivElement | null>,
    calendarRef: RefObject<CalendarRef | null>,
    calendarKey: string,
    enabled: boolean,
    onEdit: (id: string) => void,
) {
    const timeout = useRef<number | undefined>(undefined);
    const edit = useEffectEvent(onEdit);
    const pause = useCallback(() => window.clearTimeout(timeout.current), []);
    const dismiss = useCallback(() => {
        pause();
        const api = calendarRef.current?.getApi() as
            | CalendarApiImpl
            | undefined;
        if (api?.getCurrentData().eventSelection) {
            api.dispatch({ type: 'UNSELECT_EVENT' });
        }
    }, [calendarRef, pause]);
    const resume = useCallback(() => {
        if (!enabled) return;
        pause();
        timeout.current = window.setTimeout(dismiss, EVENT_SELECTION_TIMEOUT);
    }, [dismiss, enabled, pause]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!enabled || !container) return;

        const listeners = new AbortController();
        const { signal } = listeners;
        const capture = { capture: true, signal };
        const observe = { ...capture, passive: true };
        const isEditing = () => container.hasAttribute('data-calendar-editing');
        let ignoreReleaseClick = false;
        const resetReleaseClick = () => {
            ignoreReleaseClick = false;
        };
        let press: {
            origin: Touch;
            started: number;
            element: HTMLElement;
            entryId?: string;
        } | null = null;

        window.addEventListener('pointerdown', resetReleaseClick, observe);
        window.addEventListener('keydown', resetReleaseClick, observe);
        window.addEventListener(
            'click',
            (event) => {
                if (
                    ignoreReleaseClick &&
                    event.target instanceof Node &&
                    container.contains(event.target)
                ) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            },
            capture,
        );
        container.addEventListener(
            'touchstart',
            (event) => {
                resetReleaseClick();
                const { target, touches } = event;
                if (touches.length !== 1 || !(target instanceof Element))
                    return;
                const element = target.closest<HTMLElement>(TIME_EVENT);
                if (!element) return;

                const selected = element.matches(SELECTED_EVENT);
                if (selected) pause();
                press = {
                    origin: touches[0],
                    started: event.timeStamp,
                    element,
                    entryId:
                        selected && !target.closest(RESIZE_HANDLE)
                            ? getElEventRange(element)?.def.publicId
                            : undefined,
                };
            },
            observe,
        );
        window.addEventListener(
            'touchmove',
            ({ touches }) => {
                if (!press?.entryId) return;
                const { origin } = press;
                const touch = touches[0];
                if (
                    touches.length !== 1 ||
                    Math.max(
                        Math.abs(touch.clientX - origin.clientX),
                        Math.abs(touch.clientY - origin.clientY),
                    ) >= CALENDAR_TOUCH_MOVE_TOLERANCE
                ) {
                    press.entryId = undefined;
                }
            },
            observe,
        );
        const finishTouch = (event: TouchEvent) => {
            if (
                !press ||
                !Array.from(event.changedTouches).some(
                    (touch) => touch.identifier === press?.origin.identifier,
                )
            )
                return;

            const { element, entryId, started } = press;
            press = null;
            const editing = isEditing();
            if (!editing) resume();
            if (event.type !== 'touchend') return;

            const editOnTap =
                entryId &&
                event.timeStamp - started < CALENDAR_EVENT_LONG_PRESS_DELAY &&
                !container.closest('[data-swiping]');
            if (!editing && !editOnTap) return;

            // A drag release can generate a click from Safari's native switch.
            // A short tap on an already selected event opens the sheet here.
            ignoreReleaseClick = true;
            if (event.cancelable) event.preventDefault();
            if (!editOnTap) return;

            // The edit sheet restores focus to the active element when it closes.
            element.blur();
            dismiss();
            edit(entryId);
        };
        window.addEventListener('touchend', finishTouch, {
            ...capture,
            passive: false,
        });
        window.addEventListener('touchcancel', finishTouch, observe);
        window.addEventListener(
            'scroll',
            ({ target }) => {
                if (
                    !isEditing() &&
                    (target === document ||
                        target === window ||
                        (target instanceof Element &&
                            (target.contains(container) ||
                                container.contains(target))))
                ) {
                    if (press) press.entryId = undefined;
                    dismiss();
                }
            },
            observe,
        );

        return () => {
            listeners.abort();
            pause();
        };
    }, [calendarKey, containerRef, dismiss, enabled, pause, resume]);

    function handleClick({ el, jsEvent }: EventClickInfo): boolean {
        if (!enabled) return false;
        if (
            jsEvent.target instanceof Element &&
            jsEvent.target.closest(RESIZE_HANDLE)
        ) {
            return true;
        }

        const api = calendarRef.current?.getApi() as
            | CalendarApiImpl
            | undefined;
        const instanceId = getElEventRange(el)?.instance?.instanceId;
        // FullCalendar requires its own event selection for touch resizing.
        if (
            jsEvent.detail !== 0 &&
            api &&
            instanceId &&
            api.getCurrentData().eventSelection !== instanceId
        ) {
            api.dispatch({ type: 'SELECT_EVENT', eventInstanceId: instanceId });
            resume();

            return true;
        }

        if (jsEvent.detail > 0) el.blur();
        dismiss();

        return false;
    }

    return { handleClick, pause, resume };
}
