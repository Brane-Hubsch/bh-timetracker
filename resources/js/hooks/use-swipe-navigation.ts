import { useEffect, useRef, useState } from 'react';
import type { TouchEvent } from 'react';

type Direction = -1 | 1;

type Gesture = {
    id: number;
    x: number;
    y: number;
    startedAt: number;
    horizontal: boolean;
    direction?: Direction;
};

type Options = {
    followFinger?: boolean;
    canStart?: (target: Element) => boolean;
    canContinue?: (viewport: HTMLDivElement) => boolean;
    onSwipeIntent?: (direction: Direction) => void;
    onSwipe?: (direction: Direction, onFinish: () => void) => void;
};

export function useSwipeNavigation({
    followFinger = true,
    canStart = () => true,
    canContinue = () => true,
    onSwipeIntent,
    onSwipe,
}: Options) {
    const frame = useRef<HTMLDivElement>(null);
    const track = useRef<HTMLDivElement>(null);
    const gesture = useRef<Gesture | null>(null);
    const animation = useRef<Animation | null>(null);
    const [adjacent, setAdjacent] = useState<Direction | null>(null);

    useEffect(() => () => animation.current?.cancel(), []);

    function reducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function settle(direction?: Direction) {
        const slider = track.current;
        const viewport = frame.current;
        gesture.current = null;

        if (!slider || !viewport || !viewport.dataset.swiping) {
            return;
        }

        const reset = () => {
            delete viewport.dataset.swiping;
            slider.style.removeProperty('translate');
            setAdjacent(null);
        };
        const finish = () => {
            animation.current = null;
            if (direction) {
                onSwipe?.(direction, reset);
            } else {
                reset();
            }
        };

        if (reducedMotion() || (!followFinger && !direction)) {
            finish();
            return;
        }

        const from = slider.style.translate || '0px';
        const to = direction ? `${-direction * viewport.clientWidth}px` : '0px';
        slider.style.translate = to;
        animation.current = slider.animate(
            [{ translate: from }, { translate: to }],
            {
                duration: 160,
                easing: 'ease-out',
            },
        );
        animation.current.onfinish = finish;
    }

    function start(event: TouchEvent<HTMLDivElement>) {
        const viewport = event.currentTarget;

        if (event.touches.length !== 1) {
            if (gesture.current) {
                settle();
            }
            return;
        }

        const target = event.target;
        if (
            !onSwipe ||
            viewport.dataset.swiping ||
            !(target instanceof Element) ||
            !canStart(target)
        ) {
            return;
        }

        const { identifier, clientX, clientY } = event.touches[0];
        gesture.current = {
            id: identifier,
            x: clientX,
            y: clientY,
            startedAt: event.timeStamp,
            horizontal: false,
        };
    }

    function move(event: TouchEvent<HTMLDivElement>) {
        const current = gesture.current;
        const viewport = event.currentTarget;
        if (!current || !track.current) {
            return;
        }

        if (!canContinue(viewport)) {
            settle();
            return;
        }

        const touch = Array.from(event.touches).find(
            ({ identifier }) => identifier === current.id,
        );
        if (!touch) {
            return;
        }

        const x = touch.clientX - current.x;
        const y = touch.clientY - current.y;
        if (!current.horizontal) {
            if (Math.max(Math.abs(x), Math.abs(y)) < 8) {
                return;
            }

            if (Math.abs(x) <= Math.abs(y)) {
                gesture.current = null;
                return;
            }

            current.horizontal = true;
            // FullCalendar defers touch editing until a long press. A swipe
            // that has already won the gesture must not commit such an edit.
            viewport.dataset.swiping = 'true';
        }

        const direction = x <= 0 ? 1 : -1;
        if (current.direction !== direction) {
            current.direction = direction;
            onSwipeIntent?.(direction);
        }

        if (followFinger && !reducedMotion()) {
            const width = viewport.clientWidth;
            setAdjacent(direction);
            track.current.style.translate = `${Math.max(-width, Math.min(width, x))}px`;
        }
    }

    function end(event: TouchEvent<HTMLDivElement>) {
        const current = gesture.current;
        if (!current) {
            return;
        }

        const touch = Array.from(event.changedTouches).find(
            ({ identifier }) => identifier === current.id,
        );
        if (!touch) {
            return;
        }

        const distance = touch.clientX - current.x;
        const speed =
            Math.abs(distance) /
            Math.max(1, event.timeStamp - current.startedAt);
        const farEnough =
            Math.abs(distance) >= event.currentTarget.clientWidth / 3;
        const flick = Math.abs(distance) >= 32 && speed >= 0.45;
        settle(
            current.horizontal && (farEnough || flick)
                ? distance < 0
                    ? 1
                    : -1
                : undefined,
        );
    }

    return {
        adjacent,
        track,
        viewportProps: {
            ref: frame,
            onTouchStartCapture: start,
            onTouchMoveCapture: move,
            onTouchEndCapture: end,
            onTouchCancelCapture: () => {
                if (gesture.current) settle();
            },
        },
    };
}
