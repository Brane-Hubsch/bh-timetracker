import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from '@/lib/i18n';

const MIN_WIDTH = 240;
const MAX_WIDTH = 304;
const KEYBOARD_STEP = 8;

function clampWidth(width: number) {
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

export function SidebarResizeHandle({
    width,
    onResize,
}: {
    width: number;
    onResize: (width: number) => void;
}) {
    const { t } = useTranslation();
    const drag = useRef<{ id: number; x: number; width: number } | null>(null);
    const [isResizing, setIsResizing] = useState(false);

    function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
        let nextWidth: number;

        switch (event.key) {
            case 'ArrowLeft':
                nextWidth = width - KEYBOARD_STEP;
                break;
            case 'ArrowRight':
                nextWidth = width + KEYBOARD_STEP;
                break;
            case 'Home':
                nextWidth = MIN_WIDTH;
                break;
            case 'End':
                nextWidth = MAX_WIDTH;
                break;
            default:
                return;
        }

        event.preventDefault();
        onResize(clampWidth(nextWidth));
    }

    return (
        <div
            role="separator"
            tabIndex={0}
            aria-label={t('Resize sidebar')}
            aria-controls="desktop-sidebar"
            aria-orientation="vertical"
            aria-valuemin={MIN_WIDTH}
            aria-valuemax={MAX_WIDTH}
            aria-valuenow={width}
            aria-valuetext={`${width} px`}
            data-resizing={isResizing || undefined}
            className="sidebar-resize-handle fixed inset-y-0 left-(--sidebar-width) z-20 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none outline-none select-none before:absolute before:inset-y-0 before:right-1.5 before:w-px md:block"
            onKeyDown={resizeWithKeyboard}
            onPointerDown={(event) => {
                if (event.button !== 0 || drag.current) return;

                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { id: event.pointerId, x: event.clientX, width };
                setIsResizing(true);
            }}
            onPointerMove={(event) => {
                const start = drag.current;
                if (start?.id !== event.pointerId) return;

                onResize(clampWidth(start.width + event.clientX - start.x));
            }}
            onLostPointerCapture={(event) => {
                if (drag.current?.id !== event.pointerId) return;

                drag.current = null;
                setIsResizing(false);
            }}
        />
    );
}
