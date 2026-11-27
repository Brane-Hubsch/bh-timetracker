import { Button } from '@heroui/react';
import type { Ref } from 'react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export const SNOW_BLOWER_WIDTH = 48;
export const SNOW_BLOWER_HEIGHT = 34;
/** Where the chute opens, relative to the blower's left edge when it faces right. */
export const SNOW_BLOWER_CHUTE = { x: 19, y: 3 };

function SnowBlowerDrawing() {
    return (
        <svg
            viewBox="0 0 56 40"
            fill="none"
            aria-hidden="true"
            // Inline, because the button styles shrink icons to 16 px.
            // --facing is set by the animation loop: 1 drives right, -1 left.
            style={{
                width: SNOW_BLOWER_WIDTH,
                height: SNOW_BLOWER_HEIGHT,
                transform: 'scaleX(var(--facing, 1))',
            }}
        >
            <path
                d="M15 22 6 6"
                stroke="#1F2937"
                strokeWidth="3"
                strokeLinecap="round"
            />
            <path
                d="M2 6h8"
                stroke="#1F2937"
                strokeWidth="3"
                strokeLinecap="round"
            />
            <path
                d="M32 17V8a4 4 0 0 0-4-4h-6"
                stroke="#DC2626"
                strokeWidth="5"
                strokeLinecap="round"
            />
            <rect x="12" y="15" width="30" height="16" rx="4" fill="#DC2626" />
            <path d="M40 13h10a4 4 0 0 1 4 4v15H40V13Z" fill="#374151" />
            <path
                d="M43 17h8M43 21h8M43 25h8"
                stroke="#9CA3AF"
                strokeWidth="1.5"
            />
            <circle cx="19" cy="33" r="6" fill="#111827" />
            <circle cx="19" cy="33" r="2" fill="#9CA3AF" />
            <circle cx="36" cy="33" r="6" fill="#111827" />
            <circle cx="36" cy="33" r="2" fill="#9CA3AF" />
        </svg>
    );
}

/**
 * A snowblower parked next to the shovel. Once picked, it drives along the bottom with the arrow keys
 * and sprays the snow away; click it again (or press Escape) to park it. While driving, its position is
 * set directly on the element by the animation loop.
 */
/** Shown at the bottom centre while driving, so it never ends up off screen. */
export function SnowBlowerHint() {
    const { t } = useTranslation();

    return (
        <span
            aria-hidden="true"
            className="pointer-events-none fixed bottom-12 left-1/2 z-40 -translate-x-1/2 rounded-md bg-background-inverse px-2 py-1 text-xs font-medium whitespace-nowrap text-background shadow-overlay"
            data-test="snow-blower-hint"
        >
            {t('← → to drive · Esc to stop')}
        </span>
    );
}

export function SnowBlower({
    isDriving,
    onChange,
    buttonRef,
}: {
    isDriving: boolean;
    onChange: (isDriving: boolean) => void;
    buttonRef: Ref<HTMLButtonElement>;
}) {
    const { t } = useTranslation();
    const label = isDriving
        ? t('Park the snowblower')
        : t('Drive the snowblower with the arrow keys');

    return (
        <Button
            ref={buttonRef}
            variant="ghost"
            aria-label={label}
            aria-pressed={isDriving}
            onPress={() => onChange(!isDriving)}
            className={cn(
                // The parked spot; while driving, inline left/right from the loop take over.
                'fixed right-12 bottom-0 z-40 h-auto w-auto min-w-0 rounded-md bg-transparent p-0 hover:bg-transparent',
                !isDriving &&
                    'transition-transform duration-200 hover:-translate-y-0.5',
            )}
            data-test="snow-blower"
        >
            <SnowBlowerDrawing />
        </Button>
    );
}
