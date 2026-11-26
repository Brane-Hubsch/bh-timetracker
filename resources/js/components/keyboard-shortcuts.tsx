import { router, usePage } from '@inertiajs/react';
import { Fragment, useEffect, useState } from 'react';
import { isMac } from '@/components/command-palette';
import { ResponsiveDialog } from '@/components/responsive-dialog';
import { startTimer, stopTimer } from '@/components/time/running-timer';
import { useTranslation } from '@/lib/i18n';
import { shortcutFor, triggerShortcut, useShortcut } from '@/lib/shortcuts';
import { index as timeIndex } from '@/routes/time';

/** A key as shown in the shortcut lists. */
export function ShortcutKey({ children }: { children: string }) {
    return (
        <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-separator bg-default px-1.5 font-sans text-xs font-medium text-foreground">
            {children}
        </kbd>
    );
}

/**
 * Listens for single-key shortcuts across the app: N reports time, T starts or stops the timer and
 * ? shows the list; the calendar and reports also handle the arrows, I, L, V and D.
 */
export function useKeyboardShortcuts() {
    const { currentOrganization, timer } = usePage().props;

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const action = shortcutFor(event);

            if (!action) {
                return;
            }

            const handled = triggerShortcut(action);

            if (action === 'timer') {
                event.preventDefault();

                if (timer) {
                    stopTimer(timer);
                } else if (currentOrganization?.timerEnabled) {
                    startTimer(currentOrganization.slug);
                }

                return;
            }

            if (handled) {
                event.preventDefault();

                return;
            }

            // Reporting time opens the calendar's dialog from any other page.
            if (action === 'new' && currentOrganization) {
                event.preventDefault();
                router.visit(
                    timeIndex.url(currentOrganization.slug, {
                        query: { new: 1 },
                    }),
                );
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [currentOrganization, timer]);
}

/** The list of shortcuts, opened with "?", from ⌘K or the user menu. */
export function KeyboardShortcutsDialog() {
    const { t } = useTranslation();
    const [isOpen, setOpen] = useState(false);
    useShortcut('help', () => setOpen(true));

    const mod = isMac() ? '⌘' : 'Ctrl';
    const groups: { title: string; rows: [string[], string][] }[] = [
        {
            title: t('Everywhere'),
            rows: [
                [['N'], t('Report time')],
                [['T'], t('Start or stop the timer')],
                [[mod, 'K'], t('Search and commands')],
                [['?'], t('Show keyboard shortcuts')],
            ],
        },
        {
            title: t('Calendar and reports'),
            rows: [
                [['←', '→'], t('Previous or next period')],
                [['I'], t('Today')],
                [['L', 'V', 'D'], t('List, week or day (calendar)')],
            ],
        },
        {
            title: t('In dialogs'),
            rows: [
                [[mod, '↵'], t('Save (stops the running timer)')],
                [['Esc'], t('Close')],
            ],
        },
    ];

    return (
        <ResponsiveDialog
            isOpen={isOpen}
            onOpenChange={setOpen}
            title={t('Keyboard shortcuts')}
            closeInHeader
        >
            <div className="grid gap-5 pb-2" data-test="keyboard-shortcuts">
                {groups.map((group) => (
                    <section key={group.title} className="grid gap-2">
                        <h3 className="text-xs font-medium text-muted">
                            {group.title}
                        </h3>
                        <dl className="grid gap-2">
                            {group.rows.map(([keys, label]) => (
                                <div
                                    key={label}
                                    className="flex items-center justify-between gap-4 text-sm"
                                >
                                    <dt>{label}</dt>
                                    <dd className="flex shrink-0 gap-1">
                                        {keys.map((key) => (
                                            <Fragment key={key}>
                                                <ShortcutKey>{key}</ShortcutKey>
                                            </Fragment>
                                        ))}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                ))}
                <p className="text-xs text-muted">
                    {t(
                        'On a Swedish keyboard, ? is Shift and the + key. The letter shortcuts do nothing while you type in a field.',
                    )}
                </p>
            </div>
        </ResponsiveDialog>
    );
}
