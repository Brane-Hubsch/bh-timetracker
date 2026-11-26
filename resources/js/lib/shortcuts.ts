import { useEffect, useRef } from 'react';

/**
 * Single-key shortcuts. The app layout listens for keys and announces the action; pages that
 * handle it (the calendar, reports) subscribe with useShortcut. Actions nobody handles fall back to
 * the layout (e.g. "new" opens the calendar).
 */
export type ShortcutAction =
    | 'new'
    | 'timer'
    | 'previous'
    | 'next'
    | 'today'
    | 'view-list'
    | 'view-week'
    | 'view-day'
    | 'help';

const EVENT = 'timereport:shortcut';

/** Announce an action; true when a page handled it. */
export function triggerShortcut(action: ShortcutAction): boolean {
    return !window.dispatchEvent(
        new CustomEvent(EVENT, { detail: action, cancelable: true }),
    );
}

/** Handle a shortcut while the component is mounted. */
export function useShortcut(
    action: ShortcutAction,
    handler: (() => void) | undefined,
): void {
    const latest = useRef(handler);
    latest.current = handler;

    useEffect(() => {
        const listener = (event: Event) => {
            if (
                event instanceof CustomEvent &&
                event.detail === action &&
                latest.current
            ) {
                event.preventDefault();
                latest.current();
            }
        };

        window.addEventListener(EVENT, listener);

        return () => window.removeEventListener(EVENT, listener);
    }, [action]);
}

const KEYS: Record<string, ShortcutAction> = {
    n: 'new',
    t: 'timer',
    i: 'today',
    l: 'view-list',
    v: 'view-week',
    d: 'view-day',
    ArrowLeft: 'previous',
    ArrowRight: 'next',
};

/**
 * The action a key press asks for, or null when it should be left alone: while typing in a field,
 * with ⌘/Ctrl/Alt held, inside a dialog or popover, or for arrows inside widgets that use them.
 * "?" is read from the character typed, so it works on any keyboard layout (Shift + "+" in Swedish).
 */
export function shortcutFor(event: KeyboardEvent): ShortcutAction | null {
    if (
        event.defaultPrevented ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
    ) {
        return null;
    }

    const target = event.target instanceof Element ? event.target : null;

    // An open dialog or popover takes the keys; toasts (also "alertdialog") don't count.
    const dialog =
        ':is([role="dialog"], [role="alertdialog"]):not([data-slot="toast"])';

    if (
        target?.closest(
            `input, textarea, select, [contenteditable=""], [contenteditable="true"], ${dialog}`,
        ) ||
        document.querySelector(dialog)
    ) {
        return null;
    }

    if (event.key === '?') {
        return 'help';
    }

    if (event.shiftKey) {
        return null;
    }

    const action =
        KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];

    if (
        (action === 'previous' || action === 'next') &&
        target?.closest(
            '[role="listbox"], [role="menu"], [role="grid"], [role="radiogroup"], [role="tablist"], [role="toolbar"], [role="slider"]',
        )
    ) {
        return null;
    }

    return action ?? null;
}
