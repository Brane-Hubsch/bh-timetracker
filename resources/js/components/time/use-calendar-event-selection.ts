import type { CalendarRef, EventClickInfo } from '@fullcalendar/react';
import { getElEventRange } from '@fullcalendar/react/protected-api';
import type { CalendarApiImpl } from '@fullcalendar/react/protected-api';
import { useCallback, useEffectEvent, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { CALENDAR_TOUCH_MOVE_TOLERANCE } from './use-calendar-long-press';

export const CALENDAR_EVENT_LONG_PRESS_DELAY = 400;
const EVENT_SELECTION_TIMEOUT = 5000;
const RESIZE_HANDLE = '.time-calendar-resizer';
const TIME_EVENT = '.time-calendar-saved-event';
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
    const select = useCallback(
        (instanceId: string) => {
            const api = calendarRef.current?.getApi() as
                | CalendarApiImpl
                | undefined;
            if (!api || api.getCurrentData().eventSelection === instanceId)
                return false;

            // FullCalendar requires its own event selection for touch resizing.
            api.dispatch({ type: 'SELECT_EVENT', eventInstanceId: instanceId });

            return true;
        },
        [calendarRef],
    );
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
            tap?: { entryId: string; instanceId: string; wasSelected: boolean };
        } | null = null;

        window.addEventListener(
            'pointerdown',
            ({ target }) => {
                resetReleaseClick();
                if (
                    !isEditing() &&
                    !(
                        target instanceof Element &&
                        container.contains(target.closest(TIME_EVENT))
                    )
                ) {
                    dismiss();
                }
            },
            observe,
        );
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
                if (touches.length !== 1 || !(target instanceof Element)) {
                    if (press) press.tap = undefined;
                    return;
                }
                const element = target.closest<HTMLElement>(TIME_EVENT);
                if (!element) return;

                const selected = element.matches(SELECTED_EVENT);
                if (selected) pause();
                const range = getElEventRange(element);
                press = {
                    origin: touches[0],
                    started: event.timeStamp,
                    element,
                    tap:
                        range?.instance && !target.closest(RESIZE_HANDLE)
                            ? {
                                  entryId: range.def.publicId,
                                  instanceId: range.instance.instanceId,
                                  wasSelected: selected,
                              }
                            : undefined,
                };
            },
            observe,
        );
        window.addEventListener(
            'touchmove',
            ({ touches }) => {
                if (!press?.tap) return;
                const { origin } = press;
                const touch = touches[0];
                if (
                    touches.length !== 1 ||
                    Math.max(
                        Math.abs(touch.clientX - origin.clientX),
                        Math.abs(touch.clientY - origin.clientY),
                    ) >= CALENDAR_TOUCH_MOVE_TOLERANCE
                ) {
                    press.tap = undefined;
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

            const { element, tap, started } = press;
            press = null;
            const editing = isEditing();
            if (!editing) resume();
            if (event.type !== 'touchend') return;

            const shortTap =
                tap &&
                event.timeStamp - started < CALENDAR_EVENT_LONG_PRESS_DELAY &&
                !container.closest('[data-swiping]');

            // Safari can emit a separate click from the native haptic switch.
            // Handle the gesture once here before any compatibility click.
            ignoreReleaseClick = true;
            if ((editing || shortTap) && event.cancelable)
                event.preventDefault();
            if (!shortTap) return;

            if (!tap.wasSelected) {
                select(tap.instanceId);
                return;
            }

            // The edit sheet restores focus to the active element when it closes.
            element.blur();
            dismiss();
            edit(tap.entryId);
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
                    if (press) press.tap = undefined;
                    dismiss();
                }
            },
            observe,
        );

        return () => {
            listeners.abort();
            pause();
        };
    }, [calendarKey, containerRef, dismiss, enabled, pause, resume, select]);

    function handleClick({ el, jsEvent }: EventClickInfo): boolean {
        if (!enabled) return false;
        if (
            jsEvent.target instanceof Element &&
            jsEvent.target.closest(RESIZE_HANDLE)
        ) {
            return true;
        }

        const instanceId = getElEventRange(el)?.instance?.instanceId;
        if (jsEvent.detail !== 0 && instanceId && select(instanceId)) {
            resume();

            return true;
        }

        if (jsEvent.detail > 0) el.blur();
        dismiss();

        return false;
    }

    return { handleClick, pause, resume };
}
