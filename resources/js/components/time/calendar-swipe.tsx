import type { ReactNode } from 'react';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';

type Direction = -1 | 1;

type Props = {
    children: ReactNode;
    lockBrowserScroll: boolean;
    renderAdjacent: (direction: Direction) => ReactNode;
    onSwipeIntent: (direction: Direction) => void;
    onSwipe: (direction: Direction, onFinish: () => void) => void;
};

export function CalendarSwipe({
    children,
    lockBrowserScroll,
    renderAdjacent,
    onSwipeIntent,
    onSwipe,
}: Props) {
    const { adjacent, track, viewportProps } = useSwipeNavigation({
        lockBrowserScroll,
        canStart: (target) => {
            const control = target.closest(
                'button, [role="button"], .time-calendar-resizer',
            );

            return (
                !control ||
                control.matches('.time-calendar-event, .time-calendar-absence')
            );
        },
        canContinue: (viewport) =>
            !viewport.querySelector('[data-calendar-editing]'),
        onSwipeIntent,
        onSwipe,
    });

    return (
        <div
            {...viewportProps}
            className="touch-pan-y touch-pinch-zoom overflow-clip"
        >
            <div ref={track} className="relative">
                {children}
                {adjacent && (
                    <div
                        inert
                        aria-hidden="true"
                        className={`absolute top-0 w-full ${adjacent === 1 ? 'left-full' : 'right-full'}`}
                    >
                        {renderAdjacent(adjacent)}
                    </div>
                )}
            </div>
        </div>
    );
}
