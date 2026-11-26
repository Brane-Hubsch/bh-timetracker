import { isMac } from '@/components/command-palette';

/** The keys that save a dialog's form, for `aria-keyshortcuts`. */
export const SUBMIT_SHORTCUT = 'Meta+Enter Control+Enter';

/**
 * A small "⌘↵" (or "Ctrl ↵") hint inside a dialog's save button, on desktop only, so the
 * shortcut can be discovered. Screen readers get it from `aria-keyshortcuts` on the button.
 */
export function SubmitShortcutHint() {
    return (
        <span
            aria-hidden="true"
            className="hidden rounded-[5px] bg-current/15 px-1.5 text-[11px]/4 font-medium md:inline-block"
        >
            {isMac() ? '⌘↵' : 'Ctrl ↵'}
        </span>
    );
}
