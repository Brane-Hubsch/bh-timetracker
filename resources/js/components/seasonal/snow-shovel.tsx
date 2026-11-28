import { Button } from '@heroui/react';
import { useId } from 'react';
import type { Ref } from 'react';
import { useTranslation } from '@/lib/i18n';
import { SNOW_SHOVEL } from '@/lib/snow/geometry';
import { cn } from '@/lib/utils';

export const SHOVEL_WIDTH = 40;
/** Where the hand holds the shovel, from the top left corner of the drawing. */
export const SHOVEL_GRIP = { x: 20, y: 8 };
const SHOVEL_HEIGHT = SHOVEL_GRIP.y + SNOW_SHOVEL.length + 4;

/** A snow pusher: plastic grip, wooden shaft and a wide aluminium blade with a steel edge. */
function ShovelDrawing() {
    const id = useId();
    const edge = SHOVEL_GRIP.y + SNOW_SHOVEL.length;

    return (
        <svg
            width={SHOVEL_WIDTH}
            height={SHOVEL_HEIGHT}
            viewBox={`0 0 ${SHOVEL_WIDTH} ${SHOVEL_HEIGHT}`}
            fill="none"
            aria-hidden="true"
            // Inline, because the button styles shrink icons to 16 px.
            style={{ width: SHOVEL_WIDTH, height: SHOVEL_HEIGHT }}
        >
            <defs>
                <linearGradient id={`${id}-wood`} x1="0" x2="1">
                    <stop offset="0" stopColor="#8a5424" />
                    <stop offset="0.45" stopColor="#d8a465" />
                    <stop offset="1" stopColor="#9a622c" />
                </linearGradient>
                <linearGradient id={`${id}-blade`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#f4f7fb" />
                    <stop offset="0.5" stopColor="#c3cfdd" />
                    <stop offset="1" stopColor="#8d9fb6" />
                </linearGradient>
                <linearGradient id={`${id}-grip`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#ef4444" />
                    <stop offset="1" stopColor="#b91c1c" />
                </linearGradient>
            </defs>
            <rect
                x="18"
                y="14"
                width="4"
                height={edge - 46}
                rx="1.5"
                fill={`url(#${id}-wood)`}
                stroke="#5f3a17"
                strokeWidth="0.6"
            />
            <path
                fillRule="evenodd"
                d="M13 1.5h14a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-3.5v4h-7v-4H13a4 4 0 0 1-4-4v-6a4 4 0 0 1 4-4Zm1.5 4.5v5h11V6h-11Z"
                fill={`url(#${id}-grip)`}
                stroke="#7f1d1d"
                strokeWidth="0.7"
            />
            <rect
                x="16"
                y={edge - 37}
                width="8"
                height="9"
                rx="1.5"
                fill="#64748b"
                stroke="#334155"
                strokeWidth="0.7"
            />
            <path
                d={`M4 ${edge - 30}q16-4 32 0l2.5 26q-18.5 6-37 0Z`}
                fill={`url(#${id}-blade)`}
                stroke="#475569"
                strokeWidth="1"
                strokeLinejoin="round"
            />
            <path
                d={`M12 ${edge - 28}l-1.5 22M20 ${edge - 29}v24M28 ${edge - 28}l1.5 22`}
                stroke="#64748b"
                strokeOpacity="0.55"
                strokeWidth="1"
                strokeLinecap="round"
            />
            <path
                d={`M1.5 ${edge - 4}q18.5 6 37 0`}
                stroke="#334155"
                strokeWidth="2.2"
                strokeLinecap="round"
            />
        </svg>
    );
}

/**
 * The shovel in the hand: it hangs from the pointer by its grip and swings behind as the mouse moves.
 * The loop in the snow scene moves it.
 */
export function CarriedShovel({ ref }: { ref: Ref<HTMLDivElement> }) {
    return (
        <div
            ref={ref}
            aria-hidden="true"
            className="pointer-events-none fixed top-0 left-0 z-40 opacity-0 drop-shadow-md will-change-transform"
            style={{
                transformOrigin: `${SHOVEL_GRIP.x}px ${SHOVEL_GRIP.y}px`,
            }}
            data-test="carried-shovel"
        >
            <ShovelDrawing />
        </div>
    );
}

/**
 * A shovel stuck in the snow in the bottom right corner. Pick it up to shovel the drift with the mouse;
 * click the spot again (or press Escape) to put it back.
 */
export function SnowShovel({
    isShovelling,
    onChange,
}: {
    isShovelling: boolean;
    onChange: (isShovelling: boolean) => void;
}) {
    const { t } = useTranslation();
    const label = isShovelling
        ? t('Put the shovel back')
        : t('Pick up the shovel');

    return (
        <Button
            variant="ghost"
            aria-label={label}
            aria-pressed={isShovelling}
            onPress={() => onChange(!isShovelling)}
            className={cn(
                'fixed right-3 -bottom-3 z-40 h-auto w-auto min-w-0 origin-bottom rotate-[9deg] animate-enter rounded-md bg-transparent p-0 drop-shadow-sm transition-[opacity,transform] duration-200 hover:-translate-y-1 hover:rotate-[5deg] hover:bg-transparent',
                isShovelling && 'opacity-25',
            )}
            data-test="snow-shovel"
        >
            <ShovelDrawing />
        </Button>
    );
}
