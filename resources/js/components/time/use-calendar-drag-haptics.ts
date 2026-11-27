import { useRef } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';

type DragGesture = {
    control: HTMLInputElement;
    slot: { start: number; end: number } | null;
    switched: boolean;
    moved: boolean;
};

export function useCalendarDragHaptics() {
    const gesture = useRef<DragGesture | null>(null);

    const arm = (event: ReactTouchEvent<HTMLDivElement>) => {
        const touch = event.touches[0];
        const control = event.target;
        if (
            event.touches.length !== 1 ||
            !touch ||
            !(control instanceof HTMLInputElement) ||
            !control.hasAttribute('data-calendar-haptic-switch')
        ) {
            return;
        }

        const listeners = new AbortController();
        const { signal } = listeners;
        const active: DragGesture = {
            control,
            slot: null,
            switched: false,
            moved: false,
        };
        gesture.current = active;
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
        // Start on the off side and inside the thumb, before WebKit starts
        // tracking this touch. Updating checked during tracking would stop it.
        placeSwitch(touch.clientY, 8);

        control.addEventListener(
            'touchmove',
            (move) => {
                const finger = Array.from(move.touches).find(
                    ({ identifier }) => identifier === touch.identifier,
                );
                if (!finger) return;

                if (active.slot !== null) {
                    // FullCalendar has already processed the hit on this target.
                    // Keep its window listener from cancelling WebKit's native
                    // switch tracking. This switch handles the gesture itself.
                    move.stopPropagation();
                }
                placeSwitch(finger.clientY, active.switched ? 28 : 8);
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
    };

    const start = (
        target: EventTarget | null,
        start: Date | null,
        end: Date | null,
    ) => {
        const active = gesture.current;
        if (active && active.control === target && start && end) {
            active.slot = { start: start.getTime(), end: end.getTime() };
        }
    };

    const snap = (start: Date, end: Date) => {
        const active = gesture.current;
        if (!active?.slot) return;

        const slot = { start: start.getTime(), end: end.getTime() };
        if (active.slot.start === slot.start && active.slot.end === slot.end)
            return;

        active.slot = slot;
        active.switched = !active.switched;
        active.moved = true;
    };

    return { arm, start, snap };
}
