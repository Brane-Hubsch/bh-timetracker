import { useState } from 'react';
import { formatDecimalHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { formatBucket } from '@/lib/reports';
import { formatDate, isoWeek } from '@/lib/time';
import type { TimelineBucket } from '@/types';

type Props = {
    unit: 'day' | 'week';
    buckets: TimelineBucket[];
    title?: string;
};

const STEPS = [1, 2, 4, 5, 8, 10, 20, 25, 40, 50, 100, 200, 250, 500];

/** A round axis maximum (in hours) with at most four gridlines. */
function axis(maxSeconds: number): { max: number; step: number } {
    const maxHours = Math.max(maxSeconds / 3600, 1);
    const step = STEPS.find((candidate) => maxHours / candidate <= 4) ?? 1000;

    return { max: Math.ceil(maxHours / step) * step, step };
}

/**
 * Hours per day or week as bars. One series, so no legend; the selected bar (hover, focus or
 * tap) is read out above the plot, and every bar has an accessible label.
 */
export function TimelineChart({ unit, buckets, title }: Props) {
    const { t, intlLocale } = useTranslation();
    const [selected, setSelected] = useState<TimelineBucket | null>(null);
    const { max, step } = axis(
        Math.max(0, ...buckets.map((bucket) => bucket.seconds)),
    );
    const gridlines = Array.from(
        { length: max / step + 1 },
        (_, index) => index * step,
    );
    const labelEvery = Math.max(1, Math.ceil(buckets.length / 8));

    const describe = (bucket: TimelineBucket) =>
        `${formatBucket(bucket.key, unit, intlLocale, (week) => t('Week :number', { number: week }))}: ${formatDecimalHours(bucket.seconds, intlLocale)}`;

    const tick = (bucket: TimelineBucket) =>
        unit === 'week'
            ? t('w. :number', { number: isoWeek(bucket.key) })
            : formatDate(bucket.key, intlLocale, {
                  day: 'numeric',
                  month: 'numeric',
              });

    return (
        <section
            className="grid gap-3 rounded-2xl bg-surface p-4 shadow-surface"
            data-test="timeline-chart"
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">
                    {title ??
                        (unit === 'week'
                            ? t('Hours per week')
                            : t('Hours per day'))}
                </h2>
                <p
                    className="min-h-5 text-sm text-muted tabular-nums"
                    aria-live="polite"
                >
                    {selected
                        ? `${describe(selected)} · ${t(':hours billable', { hours: formatDecimalHours(selected.billableSeconds, intlLocale) })}`
                        : t('Select a bar for details.')}
                </p>
            </div>

            <div className="relative h-44 pl-10">
                {gridlines.map((hours) => (
                    <div
                        key={hours}
                        className="pointer-events-none absolute right-0 left-10 border-t border-separator"
                        style={{ bottom: `${(hours / max) * 100}%` }}
                    >
                        <span className="absolute -top-2 -left-10 w-8 text-right text-xs text-muted tabular-nums">
                            {hours} h
                        </span>
                    </div>
                ))}

                <div
                    className="relative flex h-full items-end gap-0.5"
                    role="list"
                    aria-label={title ?? t('Hours per day')}
                >
                    {buckets.map((bucket, index) => (
                        <div
                            key={bucket.key}
                            role="listitem"
                            className="flex h-full min-w-0 flex-1"
                        >
                            <button
                                type="button"
                                aria-label={describe(bucket)}
                                className="group flex h-full w-full items-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
                                onMouseEnter={() => setSelected(bucket)}
                                onFocus={() => setSelected(bucket)}
                                onClick={() => setSelected(bucket)}
                            >
                                <span
                                    className={`block w-full origin-bottom animate-grow-y rounded-t-[4px] transition-[height,background-color] duration-300 ${selected?.key === bucket.key ? 'bg-accent' : 'bg-accent/75 group-hover:bg-accent'}`}
                                    style={{
                                        height: `${(bucket.seconds / 3600 / max) * 100}%`,
                                        animationDelay: `${Math.min(index * 12, 360)}ms`,
                                    }}
                                />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex gap-0.5 pl-10" aria-hidden="true">
                {buckets.map((bucket, index) => (
                    <span
                        key={bucket.key}
                        className="min-w-0 flex-1 overflow-visible text-center text-xs whitespace-nowrap text-muted"
                    >
                        {index % labelEvery === 0 ? tick(bucket) : ''}
                    </span>
                ))}
            </div>
        </section>
    );
}
