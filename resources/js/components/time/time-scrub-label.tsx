import { useEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from '@/lib/i18n';

const MINUTES_PER_STEP = 15;
const PIXELS_PER_STEP = 12;

type ScrubLabelProps = {
    label: string;
    value: string;
    valueNow?: number;
    min?: number;
    max?: number;
    step: number;
    help: string;
    isRequired?: boolean;
    onAdjust: (offset: number) => void;
};

export function ScrubLabel({
    label,
    value,
    valueNow,
    min,
    max,
    step,
    help,
    isRequired,
    onAdjust,
}: ScrubLabelProps) {
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

            const steps = Math.trunc(
                (pointer.clientX - startX) / PIXELS_PER_STEP,
            );
            if (steps !== lastStep) {
                lastStep = steps;
                onAdjust(steps * step);
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
                onAdjust(-step);
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                onAdjust(step);
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
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={valueNow}
            aria-valuetext={value || undefined}
            title={help}
            className="inline-block w-fit cursor-ew-resize touch-none rounded-sm select-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
            onPointerDown={startDrag}
            onKeyDown={adjustWithKey}
        >
            {label}
            {isRequired && <span aria-hidden="true"> *</span>}
        </span>
    );
}

type TimeScrubLabelProps = Pick<
    ScrubLabelProps,
    'label' | 'value' | 'isRequired' | 'onAdjust'
> & {
    minutes?: number;
    maxMinutes?: number;
};

export function TimeScrubLabel({
    minutes,
    maxMinutes = 1439,
    ...props
}: TimeScrubLabelProps) {
    const { t } = useTranslation();

    return (
        <ScrubLabel
            {...props}
            valueNow={minutes}
            min={0}
            max={maxMinutes}
            step={MINUTES_PER_STEP}
            help={t('Drag or use the arrow keys to adjust by 15 minutes.')}
        />
    );
}
