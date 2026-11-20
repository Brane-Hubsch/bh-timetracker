import { useState } from 'react';
import { ProjectDot } from '@/components/project-dot';
import { formatDecimalHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { formatBucket } from '@/lib/reports';
import { formatDate, isoWeek } from '@/lib/time';
import type { TimelineBucket, TimelineProject } from '@/types';

type Props = {
    unit: 'day' | 'week';
    buckets: TimelineBucket[];
    title?: string;
    projects?: TimelineProject[];
};

type ProjectHours = TimelineProject & { seconds: number };

const STEPS = [1, 2, 4, 5, 8, 10, 20, 25, 40, 50, 100, 200, 250, 500];

/** A round axis maximum (in hours) with at most four gridlines. */
function axis(maxSeconds: number): { max: number; step: number } {
    const maxHours = Math.max(maxSeconds / 3600, 1);
    const step = STEPS.find((candidate) => maxHours / candidate <= 4) ?? 1000;

    return { max: Math.ceil(maxHours / step) * step, step };
}

function ProjectLabels({
    items,
    locale,
    maxHours,
    selected,
}: {
    items: TimelineProject[];
    locale: string;
    maxHours: number;
    selected: TimelineBucket | undefined;
}) {
    // Reserve room for the hours so selecting a bar cannot rewrap the legend and move the plot.
    const widthSample = formatDecimalHours((maxHours + 0.99) * 3600, locale);

    return (
        <ul className="flex min-w-0 flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
            {items.map(({ id, color, name, clientName }) => (
                <li key={id} className="flex min-w-0 items-start gap-1.5">
                    <span className="mt-0.5 inline-flex">
                        <ProjectDot color={color} />
                    </span>
                    <span className="wrap-anywhere">
                        {name}
                        {clientName && ` · ${clientName}`}
                    </span>
                    <span className="grid shrink-0 font-medium whitespace-nowrap text-foreground tabular-nums">
                        <span
                            className="invisible col-start-1 row-start-1"
                            aria-hidden="true"
                        >
                            {widthSample}
                        </span>
                        {selected && (
                            <span className="col-start-1 row-start-1">
                                {formatDecimalHours(
                                    selected.projectSeconds?.[id] ?? 0,
                                    locale,
                                )}
                            </span>
                        )}
                    </span>
                </li>
            ))}
        </ul>
    );
}

/** Hours per day or week, stacked by project in reports and by billable status on project pages. */
export function TimelineChart({ unit, buckets, title, projects }: Props) {
    const { t, intlLocale } = useTranslation();
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const selected = buckets.find((bucket) => bucket.key === selectedKey);
    const chartTitle =
        title ?? (unit === 'week' ? t('Hours per week') : t('Hours per day'));
    const projectsById = new Map(
        projects?.map((project) => [project.id, project]),
    );
    const projectHours = (bucket: TimelineBucket): ProjectHours[] =>
        Object.entries(bucket.projectSeconds ?? {}).flatMap(([id, seconds]) => {
            const project = projectsById.get(Number(id));

            return project ? [{ ...project, seconds }] : [];
        });
    const { max, step } = axis(
        Math.max(0, ...buckets.map((bucket) => bucket.seconds)),
    );
    const gridlines = Array.from(
        { length: max / step + 1 },
        (_, index) => index * step,
    );
    const labelEvery = Math.max(1, Math.ceil(buckets.length / 8));
    const hasBillable = buckets.some((bucket) => bucket.billableSeconds > 0);
    const hasNonBillable = buckets.some(
        (bucket) => bucket.seconds > bucket.billableSeconds,
    );

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
            className="grid h-full content-between gap-3 rounded-2xl bg-surface p-4 shadow-surface"
            data-test="timeline-chart"
        >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <h2 className="text-sm font-semibold">{chartTitle}</h2>
                    {!projects && hasBillable && hasNonBillable && (
                        <ul
                            className="flex items-center gap-3 text-xs text-muted"
                            data-test="timeline-legend"
                        >
                            <li className="flex items-center gap-1.5">
                                <span className="size-2.5 rounded-xs bg-accent" />
                                {t('Billable')}
                            </li>
                            <li className="flex items-center gap-1.5">
                                <span className="size-2.5 rounded-xs bg-accent/35" />
                                {t('Non-billable')}
                            </li>
                        </ul>
                    )}
                </div>
                <p
                    className="min-h-5 text-sm text-muted tabular-nums"
                    aria-live="polite"
                >
                    {selected
                        ? describe(selected)
                        : t('Select a bar for details.')}
                    {selected &&
                        !projects &&
                        ` · ${t(':hours billable', { hours: formatDecimalHours(selected.billableSeconds, intlLocale) })}`}
                </p>
            </div>

            {projects && projects.length > 0 && (
                <div data-test="timeline-legend">
                    <ProjectLabels
                        items={projects}
                        locale={intlLocale}
                        maxHours={max}
                        selected={selected}
                    />
                </div>
            )}

            <div className={`relative pl-10 ${projects ? 'h-60' : 'h-48'}`}>
                {gridlines.map((hours) => (
                    <div
                        key={hours}
                        // The baseline is drawn over the bars, so sub-pixel rounding can't make them look uneven.
                        className={`pointer-events-none absolute right-0 left-10 border-t border-separator ${hours === 0 ? 'z-10' : ''}`}
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
                    aria-label={chartTitle}
                >
                    {buckets.map((bucket, index) => {
                        const segments = projectHours(bucket);

                        return (
                            <div
                                key={bucket.key}
                                role="listitem"
                                className="flex h-full min-w-0 flex-1"
                            >
                                <button
                                    type="button"
                                    aria-label={[
                                        describe(bucket),
                                        ...segments.map(
                                            ({ name, clientName, seconds }) =>
                                                `${name}${clientName ? ` · ${clientName}` : ''}: ${formatDecimalHours(seconds, intlLocale)}`,
                                        ),
                                    ].join('. ')}
                                    className="group flex h-full w-full items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
                                    onMouseEnter={() =>
                                        setSelectedKey(bucket.key)
                                    }
                                    onFocus={() => setSelectedKey(bucket.key)}
                                    onClick={() => setSelectedKey(bucket.key)}
                                >
                                    {/* The segments shrink to fit instead of overflowing, so every bar ends exactly on the baseline. */}
                                    <span
                                        className={`flex w-full max-w-6 origin-bottom animate-grow-y transition-[height,opacity] duration-300 ${projects ? 'flex-col-reverse' : 'flex-col justify-end gap-0.5'} ${!selected || selected.key === bucket.key ? '' : 'opacity-70 group-hover:opacity-100'}`}
                                        style={{
                                            height: `${(bucket.seconds / 3600 / max) * 100}%`,
                                            animationDelay: `${Math.min(index * 12, 360)}ms`,
                                        }}
                                    >
                                        {projects ? (
                                            segments.map(
                                                ({ id, color, seconds }) => (
                                                    <span
                                                        key={id}
                                                        className="min-h-0 basis-0 shadow-[inset_0_-1px_var(--surface)] first:shadow-none last:rounded-t-[4px]"
                                                        style={{
                                                            flexGrow: seconds,
                                                            backgroundColor:
                                                                color,
                                                        }}
                                                    />
                                                ),
                                            )
                                        ) : (
                                            <>
                                                {bucket.seconds >
                                                    bucket.billableSeconds && (
                                                    <span className="min-h-px flex-1 rounded-t-[4px] bg-accent/35" />
                                                )}
                                                {bucket.billableSeconds > 0 && (
                                                    <span
                                                        className="min-h-px bg-accent first:rounded-t-[4px]"
                                                        style={{
                                                            height: `${(bucket.billableSeconds / bucket.seconds) * 100}%`,
                                                        }}
                                                    />
                                                )}
                                            </>
                                        )}
                                    </span>
                                </button>
                            </div>
                        );
                    })}
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
