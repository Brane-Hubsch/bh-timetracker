import { Button } from '@heroui/react';
import { router, usePage } from '@inertiajs/react';
import { Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { formatClock } from '@/lib/time';
import { cn } from '@/lib/utils';
import { index as timeIndex } from '@/routes/time';
import {
    start as startTimerRoute,
    stop as stopTimerRoute,
} from '@/routes/timer';
import type { RunningTimer } from '@/types';

/** A timer running this long asks for the end time when stopped (RunningTimer::LONG_SECONDS). */
const LONG_SECONDS = 10 * 3600;

export function startTimer(organization: string) {
    router.post(
        startTimerRoute.url(organization),
        {},
        { preserveScroll: true, preserveState: true },
    );
}

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
 * The running timer as a quiet row: a pulsing dot, the clock and the project, with a small stop
 * button. The sidebar surface stays mounted for the transition to and from the shortcuts. On
 * mobile it floats above the bottom navigation. Pressing the row opens the timer.
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

    const sidebar = variant === 'sidebar';

    if (!timer && !sidebar) {
        return null;
    }

    const elsewhere =
        timer && currentOrganization?.slug !== timer.organization.slug
            ? timer.organization.name
            : null;
    const label = [timer?.project?.name ?? t('No project'), elsewhere]
        .filter(Boolean)
        .join(' · ');

    return (
        <div
            className={cn(
                'flex items-center gap-1 border border-separator bg-background text-sm',
                sidebar
                    ? 'rounded-full p-[3px] ps-0 shadow-sm'
                    : 'rounded-xl p-1 ps-0 shadow-surface',
                className,
            )}
            aria-hidden={!timer || undefined}
            data-test={timer ? 'running-timer' : undefined}
        >
            {timer && (
                <>
                    <button
                        type="button"
                        onClick={() => openTimer(timer)}
                        className={cn(
                            'flex min-w-0 flex-1 items-center gap-2 py-1 ps-3 text-left transition-colors hover:bg-default focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none',
                            sidebar ? 'rounded-full' : 'rounded-lg',
                        )}
                        aria-label={t('Open the running timer')}
                    >
                        <span
                            aria-hidden="true"
                            className="relative flex size-3 shrink-0 items-center justify-center"
                        >
                            <span className="absolute inset-0 rounded-full bg-danger/20 motion-safe:animate-pulse" />
                            <span className="size-1.5 rounded-full bg-danger" />
                        </span>
                        <span
                            className="shrink-0 font-semibold tabular-nums"
                            data-test="running-timer-clock"
                        >
                            {formatClock(elapsed)}
                        </span>
                        <span className="min-w-0 truncate text-muted">
                            {label}
                        </span>
                    </button>
                    <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={t('Stop the timer')}
                        onPress={() => stopTimer(timer)}
                        className={cn(
                            'size-7 min-w-7 shrink-0 bg-default',
                            sidebar ? 'rounded-full' : 'rounded-lg',
                        )}
                        data-test="running-timer-stop"
                    >
                        <Square
                            aria-hidden="true"
                            className="size-2.5 fill-current"
                        />
                    </Button>
                </>
            )}
        </div>
    );
}
