import { useEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from '@/lib/i18n';
import adjustTimeIcon from './adjust-time.svg';

const MINUTES_PER_STEP = 15;
const PIXELS_PER_STEP = 12;

type Props = {
    label: string;
    value: string;
    minutes?: number;
    maxMinutes?: number;
    onAdjust: (offset: number) => void;
};

export function TimeDragHandle({
    label,
    value,
    minutes,
    maxMinutes = 1439,
    onAdjust,
}: Props) {
    const { t } = useTranslation();
    const drag = useRef<AbortController | null>(null);
    useEffect(() => () => drag.current?.abort(), []);

    const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
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
        // Follow the pointer across both halves of the field and beyond the dialog.
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

    const adjustWithKey = (event: KeyboardEvent<HTMLDivElement>) => {
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
        <div
            role="spinbutton"
            tabIndex={0}
            aria-label={t('Adjust :field', { field: label })}
            aria-valuemin={0}
            aria-valuemax={maxMinutes}
            aria-valuenow={minutes}
            aria-valuetext={value || undefined}
            title={t('Drag or use the arrow keys to adjust by 15 minutes.')}
            className="flex size-8 cursor-ew-resize touch-none items-center justify-center rounded-field select-none hover:bg-default focus-visible:bg-default"
            onPointerDown={startDrag}
            onKeyDown={adjustWithKey}
            onClick={(event) => event.stopPropagation()}
        >
            <img
                className="pointer-events-none dark:invert"
                src={adjustTimeIcon}
                alt=""
            />
        </div>
    );
}
