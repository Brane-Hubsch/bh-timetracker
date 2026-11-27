import { Button } from '@heroui/react';
import type { Ref } from 'react';
import snowBlowerImage from '@/assets/snowblower.svg';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export const SNOW_BLOWER_WIDTH = 84;
export const SNOW_BLOWER_HEIGHT = 55;
/** Where the chute opens, relative to the blower's left edge when it faces right. */
export const SNOW_BLOWER_CHUTE = { x: 70, y: 11 };

/** "Snow Blower" from OpenClipart, public domain; it faces left as drawn. */
function SnowBlowerDrawing() {
    return (
        <img
            src={snowBlowerImage}
            alt=""
            draggable={false}
            // --facing is set by the animation loop: 1 drives right, -1 (and parked) faces left.
            style={{
                width: SNOW_BLOWER_WIDTH,
                height: SNOW_BLOWER_HEIGHT,
                transform: 'scaleX(calc(var(--facing, -1) * -1))',
            }}
        />
    );
}

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
