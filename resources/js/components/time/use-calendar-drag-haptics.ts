import { useRef } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';

type DragGesture = {
    control: HTMLInputElement;
    slot: { start: number; end: number } | null;
    pickupPending: boolean;
    switched: boolean;
    moved: boolean;
    trackTouch: (event: TouchEvent) => boolean;
};

function snapGesture(gesture: DragGesture, start: number, end: number) {
    const previous = gesture.slot;
    if (previous?.start === start && previous?.end === end) return;

    gesture.slot = { start, end };
    if (previous) {
        // A resize can start and snap on the same touchmove. One switch
        // transition covers both so the pickup pulse is never cancelled.
        if (!gesture.pickupPending) gesture.switched = !gesture.switched;
        gesture.moved = true;
    }
}

export function useCalendarDragHaptics() {
    const gesture = useRef<DragGesture | null>(null);

    const armSwitch = (control: HTMLInputElement, touch: Touch) => {
        const listeners = new AbortController();
        const { signal } = listeners;
        control.checked = false;
        // Rotate a horizontal switch. A square keeps the two axes equal even
        // in WebKit versions that measure the transformed bounding box.
        control.style.width = '40px';
        control.style.height = '40px';
        control.style.maxHeight = 'none';
        control.style.maxWidth = 'none';
        control.style.rotate = '90deg';
        // FullCalendar hides the dragged source while it renders the mirror.
        control.style.visibility = 'visible';
        control.style.removeProperty('translate');

        let offset = 0;
        const placeSwitch = (fingerY: number, distanceFromTop: number) => {
            const unshiftedTop = control.getBoundingClientRect().top - offset;
            offset = fingerY - unshiftedTop - distanceFromTop;
            control.style.translate = `0 ${offset}px`;
            // Resolve the new position before WebKit handles this touch.
            control.getBoundingClientRect();
        };
        const active: DragGesture = {
            control,
            slot: null,
            pickupPending: false,
            switched: false,
            moved: false,
            trackTouch: ({ touches }) => {
                const finger = Array.from(touches).find(
                    ({ identifier }) => identifier === touch.identifier,
                );
                if (!finger) return false;

                if (active.pickupPending) {
                    active.pickupPending = false;
                    active.switched = !active.switched;
                }
                placeSwitch(finger.clientY, active.switched ? 28 : 8);

                return true;
            },
        };
        gesture.current = active;
        // Start on the off side and inside the thumb, before WebKit starts
        // tracking this touch. Updating checked during tracking would stop it.
        placeSwitch(touch.clientY, 8);

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

            if (active.slot !== null && !active.moved) end.preventDefault();
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

        const active = armSwitch(target, touch);
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
    ) => {
        const active = gesture.current;
        if (active && active.control === target && start && end) {
            active.slot = { start: start.getTime(), end: end.getTime() };
            // Safari's native switch can pulse on the next physical touchmove.
            active.pickupPending = true;
        }
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
