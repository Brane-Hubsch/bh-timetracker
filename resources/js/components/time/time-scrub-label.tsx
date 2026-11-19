import { useEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from '@/lib/i18n';

const MINUTES_PER_STEP = 15;
const PIXELS_PER_STEP = 12;

type Props = {
    label: string;
    value: string;
    minutes?: number;
    maxMinutes?: number;
    isRequired?: boolean;
    onAdjust: (offset: number) => void;
};

export function TimeScrubLabel({
    label,
    value,
    minutes,
    maxMinutes = 1439,
    isRequired,
    onAdjust,
}: Props) {
    const { t } = useTranslation();
    const drag = useRef<AbortController | null>(null);
    useEffect(() => () => drag.current?.abort(), []);

    const startDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
        if (!event.isPrimary || event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.focus({ preventScroll: true });
        drag.current?.abort();
        const controller = new AbortController();
        drag.current = controller;

        const { clientX: startX, pointerId } = event;
        let lastStep = 0;
        const move = (pointer: PointerEvent) => {
            if (pointer.pointerId !== pointerId) {
                return;
            }

            const step = Math.trunc(
                (pointer.clientX - startX) / PIXELS_PER_STEP,
            );
            if (step !== lastStep) {
                lastStep = step;
                onAdjust(step * MINUTES_PER_STEP);
            }
        };
        const finish = (pointer: PointerEvent) => {
            if (pointer.pointerId === pointerId) {
                controller.abort();
            }
        };
        // Follow the pointer beyond the label and the dialog.
        const options = { capture: true, signal: controller.signal };
        window.addEventListener('pointermove', move, options);
        window.addEventListener(
            'pointerup',
            (pointer) => {
                move(pointer);
                finish(pointer);
            },
            options,
        );
        window.addEventListener('pointercancel', finish, options);
        window.addEventListener('blur', () => controller.abort(), {
            signal: controller.signal,
        });
    };

    const adjustWithKey = (event: KeyboardEvent<HTMLSpanElement>) => {
        switch (event.key) {
            case 'ArrowLeft':
            case 'ArrowDown':
                onAdjust(-MINUTES_PER_STEP);
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                onAdjust(MINUTES_PER_STEP);
                break;
            default:
                return;
        }
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <span
            role="spinbutton"
            tabIndex={0}
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={maxMinutes}
            aria-valuenow={minutes}
            aria-valuetext={value || undefined}
            title={t('Drag or use the arrow keys to adjust by 15 minutes.')}
            className="inline-block w-fit cursor-ew-resize touch-none rounded-sm select-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
            onPointerDown={startDrag}
            onKeyDown={adjustWithKey}
        >
            {label}
            {isRequired && <span aria-hidden="true"> *</span>}
        </span>
    );
}
