import { Button } from '@heroui/react';
import { router, usePage } from '@inertiajs/react';
import { Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { formatClock } from '@/lib/time';
import { cn } from '@/lib/utils';
import { index as timeIndex } from '@/routes/time';
import { stop as stopTimerRoute } from '@/routes/timer';
import type { RunningTimer } from '@/types';

/** A timer running this long asks for the end time when stopped (RunningTimer::LONG_SECONDS). */
const LONG_SECONDS = 10 * 3600;

/** Seconds the timer has run, updated every second while mounted. */
export function useElapsedSeconds(timer: RunningTimer | null): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!timer) {
            return;
        }

        setNow(Date.now());
        const interval = window.setInterval(() => setNow(Date.now()), 1000);

        return () => window.clearInterval(interval);
    }, [timer]);

    return timer ? (now - Date.parse(timer.startedAt)) / 1000 : 0;
}

/**
 * Open the timer in its organization's calendar: to edit it, or to stop it when it needs a
 * project or an end time first.
 */
export function openTimer(
    timer: RunningTimer,
    action: 'edit' | 'stop' = 'edit',
) {
    router.visit(
        timeIndex.url(
            { current_organization: timer.organization.slug },
            {
                query: {
                    date: timer.start.slice(0, 10),
                    timer: action,
                },
            },
        ),
    );
}

/**
 * Stop the timer right away, or open it first when it has no project or ran so long that the end
 * should be checked.
 */
export function stopTimer(timer: RunningTimer) {
    const elapsed = (Date.now() - Date.parse(timer.startedAt)) / 1000;

    if (!timer.project || elapsed >= LONG_SECONDS) {
        openTimer(timer, 'stop');

        return;
    }

    router.post(
        stopTimerRoute.url({ current_organization: timer.organization.slug }),
        {},
        { preserveScroll: true, preserveState: true },
    );
}

/** Puts the running clock in front of the page title, e.g. "▶ 1:23 · Webbshop | Kalender – …". */
export function useTimerTitle() {
    const { timer } = usePage().props;
    const { t } = useTranslation();

    useEffect(() => {
        const strip = (title: string) => title.replace(/^▶ [^|]* \| /, '');

        if (!timer) {
            document.title = strip(document.title);

            return;
        }

        const update = () => {
            const minutes = Math.floor(
                (Date.now() - Date.parse(timer.startedAt)) / 60000,
            );
            const clock = `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
            document.title = `▶ ${clock} · ${timer.project?.name ?? t('Timer')} | ${strip(document.title)}`;
        };

        update();
        const interval = window.setInterval(update, 15000);
        // Inertia sets a new title on every visit.
        const stopListening = router.on('navigate', () =>
            window.setTimeout(update),
        );

        return () => {
            window.clearInterval(interval);
            stopListening();
            document.title = strip(document.title);
        };
    }, [timer, t]);
}

/**
 * The running timer: a card in the sidebar on desktop, a bar above the bottom navigation on mobile.
 * Pressing it opens the timer; the round button stops it.
 */
export function RunningTimerCard({
    variant,
    className,
}: {
    variant: 'sidebar' | 'bar';
    className?: string;
}) {
    const { t } = useTranslation();
    const { timer, currentOrganization } = usePage().props;
    const elapsed = useElapsedSeconds(timer);

    if (!timer) {
        return null;
    }

    const elsewhere =
        currentOrganization?.slug !== timer.organization.slug
            ? timer.organization.name
            : null;
    const subtitle =
        variant === 'bar'
            ? [timer.project?.clientName, timer.description, elsewhere]
                  .filter(Boolean)
                  .join(' · ')
            : [timer.project?.clientName, elsewhere]
                  .filter(Boolean)
                  .join(' · ');

    return (
        <div
            className={cn(
                'flex items-center gap-3',
                variant === 'sidebar'
                    ? 'rounded-2xl bg-accent-soft p-3'
                    : 'rounded-2xl bg-surface p-2 ps-4 shadow-surface',
                className,
            )}
            data-test="running-timer"
        >
            <button
                type="button"
                onClick={() => openTimer(timer)}
                className="grid min-w-0 flex-1 gap-0.5 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                aria-label={t('Open the running timer')}
            >
                <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{
                            backgroundColor:
                                timer.project?.color ?? 'var(--muted)',
                        }}
                    />
                    {/* The project keeps most of the room; the client gets what is left. */}
                    <span className="max-w-[75%] shrink-0 truncate font-semibold">
                        {timer.project?.name ?? t('No project yet')}
                    </span>
                    {variant === 'sidebar' && subtitle && (
                        <span className="min-w-0 truncate text-muted">
                            {subtitle}
                        </span>
                    )}
                </span>
                {variant === 'bar' && subtitle && (
                    <span className="truncate text-xs text-muted">
                        {subtitle}
                    </span>
                )}
                {variant === 'sidebar' && (
                    <span
                        className="text-xl font-semibold tabular-nums"
                        data-test="running-timer-clock"
                    >
                        {formatClock(elapsed)}
                    </span>
                )}
            </button>
            {variant === 'bar' && (
                <span
                    className="font-semibold tabular-nums"
                    data-test="running-timer-clock"
                >
                    {formatClock(elapsed)}
                </span>
            )}
            <Button
                isIconOnly
                aria-label={t('Stop the timer')}
                onPress={() => stopTimer(timer)}
                className={cn(
                    'shrink-0 rounded-full bg-danger text-danger-foreground',
                    variant === 'sidebar' ? 'size-9' : 'size-10',
                )}
                data-test="running-timer-stop"
            >
                <Square className="size-3.5 fill-current" />
            </Button>
        </div>
    );
}
