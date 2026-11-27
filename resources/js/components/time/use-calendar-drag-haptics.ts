import { useRef } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';

const SWITCH_SIZE = 40;
const SWITCH_OFF_OFFSET = 4;
const SWITCH_ON_OFFSET = SWITCH_SIZE - SWITCH_OFF_OFFSET;

type Slot = { start: number; end: number };

type DragGesture = {
    control: HTMLInputElement;
    slot: Slot | null;
    trackedSlot: Slot | null;
    moved: boolean;
    trackTouch: (event: TouchEvent) => boolean;
};

function snapGesture(gesture: DragGesture, start: number, end: number) {
    const previous = gesture.slot;
    if (previous?.start === start && previous?.end === end) return;

    gesture.slot = { start, end };
    if (previous) gesture.moved = true;
}

export function useCalendarDragHaptics() {
    const gesture = useRef<DragGesture | null>(null);

    const armSwitch = (
        control: HTMLInputElement,
        touch: Touch,
        allowReleaseHaptic = false,
    ) => {
        const listeners = new AbortController();
        const { signal } = listeners;
        control.checked = false;
        // Rotate a horizontal switch. A square keeps the two axes equal even
        // in WebKit versions that measure the transformed bounding box.
        control.style.width = `${SWITCH_SIZE}px`;
        control.style.height = `${SWITCH_SIZE}px`;
        control.style.maxHeight = 'none';
        control.style.maxWidth = 'none';
        control.style.rotate = '90deg';
        // FullCalendar hides the dragged source while it renders the mirror.
        control.style.visibility = 'visible';
        control.style.removeProperty('translate');

        let offsetX = 0;
        let offsetY = 0;
        const placeSwitch = (
            { clientX, clientY }: Touch,
            distanceFromTop: number,
        ) => {
            const { left, top } = control.getBoundingClientRect();
            offsetX += clientX - left - SWITCH_SIZE / 2;
            offsetY += clientY - top - distanceFromTop;
            control.style.translate = `${offsetX}px ${offsetY}px`;
            // Resolve the new position before WebKit handles this touch.
            control.getBoundingClientRect();
        };
        let switched = false;
        const active: DragGesture = {
            control,
            slot: null,
            trackedSlot: null,
            moved: false,
            trackTouch: ({ touches }) => {
                const finger = Array.from(touches).find(
                    ({ identifier }) => identifier === touch.identifier,
                );
                if (!finger) return false;

                if (active.slot !== active.trackedSlot) {
                    active.trackedSlot = active.slot;
                    switched = !switched;
                }
                // Leave room for WebKit's initial drag threshold even if the
                // finger shifted slightly while the long press was starting.
                placeSwitch(
                    finger,
                    switched ? SWITCH_ON_OFFSET : SWITCH_OFF_OFFSET,
                );

                return true;
            },
        };
        gesture.current = active;
        // Start on the off side and inside the thumb, before WebKit starts
        // tracking this touch. Updating checked during tracking would stop it.
        placeSwitch(touch, SWITCH_OFF_OFFSET);

        control.addEventListener(
            'touchmove',
            (move) => {
                if (active.trackTouch(move) && active.slot !== null) {
                    // The calendar has already processed this touch. Keep
                    // FullCalendar's window listener from cancelling native
                    // switch tracking.
                    move.stopPropagation();
                }
            },
            { signal },
        );

        const finish = (end: TouchEvent) => {
            if (
                !Array.from(end.changedTouches).some(
                    ({ identifier }) => identifier === touch.identifier,
                )
            ) {
                return;
            }

            if (active.slot !== null && !active.moved && !allowReleaseHaptic) {
                end.preventDefault();
            }
            listeners.abort();

            // Leave the control in place until Safari finishes the native touch.
            requestAnimationFrame(() => {
                if (gesture.current !== active) return;
                control.style.removeProperty('width');
                control.style.removeProperty('height');
                control.style.removeProperty('max-height');
                control.style.removeProperty('max-width');
                control.style.removeProperty('rotate');
                control.style.removeProperty('translate');
                control.style.removeProperty('visibility');
                gesture.current = null;
            });
        };
        control.addEventListener('touchend', finish, { signal });
        control.addEventListener('touchcancel', finish, { signal });

        return active;
    };

    const arm = (event: ReactTouchEvent<HTMLDivElement>) => {
        const { touches } = event.nativeEvent;
        const touch = touches[0];
        const control = event.target;
        if (
            touches.length === 1 &&
            touch &&
            control instanceof HTMLInputElement &&
            control.hasAttribute('data-calendar-haptic-switch')
        ) {
            armSwitch(control, touch);
        }
    };

    const armSelection = (target: Element, touch: Touch) => {
        if (
            !(target instanceof HTMLInputElement) ||
            !target.hasAttribute('data-calendar-haptic-selection')
        ) {
            return;
        }

        const active = armSwitch(target, touch, true);
        return (start: string, end: string) => {
            if (gesture.current === active) {
                snapGesture(
                    active,
                    Date.parse(`${start}:00Z`),
                    Date.parse(`${end}:00Z`),
                );
            }
        };
    };

    const start = (
        target: EventTarget | null,
        start: Date | null,
        end: Date | null,
    ): boolean => {
        const active = gesture.current;
        if (!active || active.control !== target || !start || !end)
            return false;

        // The first touchmove tracks this slot for the pickup pulse. If a
        // resize also snaps on that move, it tracks the new slot once.
        active.slot = { start: start.getTime(), end: end.getTime() };

        return true;
    };

    const snap = (start: Date, end: Date) => {
        const active = gesture.current;
        if (active?.slot) {
            snapGesture(active, start.getTime(), end.getTime());
        }
    };

    const moveHeldSwitch = (event: TouchEvent) => {
        const active = gesture.current;
        if (!active || active.slot === null || active.control !== event.target)
            return false;

        return active.trackTouch(event);
    };

    return { arm, armSelection, start, snap, moveHeldSwitch };
}
