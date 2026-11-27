import { useRef } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';

type DragGesture = {
    control: HTMLInputElement;
    slot: number | null;
    switched: boolean;
    moved: boolean;
};

export function useCalendarDragHaptics() {
    const gesture = useRef<DragGesture | null>(null);

    const arm = (event: ReactTouchEvent<HTMLInputElement>) => {
        const touch = event.touches[0];
        if (event.touches.length !== 1 || !touch) return;

        const control: HTMLInputElement = event.currentTarget;
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
        control.style.width = '24px';
        control.style.height = '40px';
        control.style.removeProperty('translate');

        let offset = 0;
        const placeSwitch = (fingerY: number, distanceFromTop: number) => {
            const unshiftedTop = control.getBoundingClientRect().top - offset;
            offset = fingerY - unshiftedTop - distanceFromTop;
            control.style.translate = `0 ${offset}px`;
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
                control.style.removeProperty('translate');
                gesture.current = null;
            });
        };
        control.addEventListener('touchend', finish, { signal });
        control.addEventListener('touchcancel', finish, { signal });
    };

    const start = (target: EventTarget | null, date: Date | null) => {
        const active = gesture.current;
        if (active && active.control === target && date) {
            active.slot = date.getTime();
        }
    };

    const snap = (date: Date) => {
        const active = gesture.current;
        const slot = date.getTime();
        if (!active || active.slot === null || active.slot === slot) return;

        active.slot = slot;
        active.switched = !active.switched;
        active.moved = true;
    };

    return { arm, start, snap };
}
