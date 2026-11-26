import { useCallback } from 'react';

export function useKeyboardInset() {
    return useCallback((sheet: HTMLDivElement | null) => {
        const viewport = window.visualViewport;

        if (!sheet || !viewport) {
            return;
        }

        let frame = 0;
        let previousHeight = 0;
        let previousField: Element | null = null;

        const update = () => {
            // Match React Aria's viewport handling while the user pinch-zooms.
            if (viewport.scale !== 1) {
                return;
            }

            sheet.style.setProperty(
                '--sheet-viewport-top',
                `${viewport.offsetTop}px`,
            );
            const height = viewport.height;
            const field = document.activeElement;

            // A viewport scroll can happen during a swipe inside the body. Keep the
            // sheet positioned without scrolling back to the same field on every swipe.
            if (height === previousHeight && field === previousField) {
                return;
            }

            previousHeight = height;
            previousField = field;
            sheet.style.setProperty('--sheet-viewport-height', `${height}px`);

            const body = field?.closest<HTMLElement>(
                '[data-slot="drawer-body"]',
            );

            if (!field || !body || !sheet.contains(body)) {
                return;
            }

            // Scroll the drawer body directly. scrollIntoView can also move the page on iOS.
            const fieldRect = field.getBoundingClientRect();
            const bodyRect = body.getBoundingClientRect();
            const padding = 12;
            const above = fieldRect.top - bodyRect.top - padding;
            const below = fieldRect.bottom - bodyRect.bottom + padding;

            if (above < 0 || below > 0) {
                body.scrollTop += above < 0 ? above : below;
            }
        };

        const scheduleUpdate = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(update);
        };

        scheduleUpdate();
        viewport.addEventListener('resize', scheduleUpdate);
        viewport.addEventListener('scroll', scheduleUpdate);
        sheet.addEventListener('focusin', scheduleUpdate);

        return () => {
            cancelAnimationFrame(frame);
            viewport.removeEventListener('resize', scheduleUpdate);
            viewport.removeEventListener('scroll', scheduleUpdate);
            sheet.removeEventListener('focusin', scheduleUpdate);
        };
    }, []);
}
