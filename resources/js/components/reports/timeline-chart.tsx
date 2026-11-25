import { Pressable, Tooltip } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ProjectDot } from '@/components/project-dot';
import { BreakdownTooltip } from '@/components/reports/breakdown-tooltip';
import { formatDecimalHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { formatBucket, isWholeMonths } from '@/lib/reports';
import { formatDate, isoWeek } from '@/lib/time';
import type { TimelineBucket, TimelineProject } from '@/types';

type Props = {
    unit: 'day' | 'week' | 'month';
    buckets: TimelineBucket[];
    title?: string;
    projects?: TimelineProject[];
    headerAction?: ReactNode;
};

type ProjectHours = TimelineProject & { seconds: number };
type TooltipSource = 'hover' | 'focus' | 'touch';

const STEPS = [1, 2, 4, 5, 8, 10, 20, 25, 40, 50, 100, 200, 250, 500];
const DAY_COLUMN_WIDTH_REM = 1.25;
const HOURS_AXIS_WIDTH_REM = 2.5;
const TIMELINE_TITLES = {
    day: 'Hours per day',
    week: 'Hours per week',
    month: 'Hours per month',
} as const;

/** A round axis maximum (in hours) with at most four gridlines. */
function axis(maxSeconds: number): { max: number; step: number } {
    const maxHours = Math.max(maxSeconds / 3600, 1);
    const step =
        STEPS.find((candidate) => maxHours / candidate <= 4) ??
        1000 * Math.ceil(maxHours / 4000);

    return { max: Math.ceil(maxHours / step) * step, step };
}

function projectLabel({ name, clientName }: TimelineProject) {
    return clientName ? `${name} · ${clientName}` : name;
}

function ProjectLabels({ items }: { items: TimelineProject[] }) {
    return (
        <ul className="flex h-4 min-w-0 [scrollbar-width:none] gap-4 overflow-x-auto text-xs whitespace-nowrap text-muted">
            {items.map((project) => (
                <li
                    key={project.id}
                    className="flex shrink-0 items-center gap-1.5"
                >
                    <ProjectDot color={project.color} />
                    {projectLabel(project)}
                </li>
            ))}
        </ul>
    );
}

const buttonClassName =
    'group flex h-full w-full items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset';

function ProjectTimelineBar({
    title,
    segments,
    className,
    style,
    source,
    onChange,
}: {
    title: string;
    segments: ProjectHours[];
    className: string;
    style: CSSProperties;
    source: TooltipSource | null;
    onChange: (source: TooltipSource | null) => void;
}) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const anchorRef = useRef<HTMLSpanElement>(null);
    const items = segments.map((project) => ({
        key: project.id,
        label: project.name,
        clientName: project.clientName,
        color: project.color,
        seconds: project.seconds,
    }));

    useEffect(() => {
        if (source !== 'touch') return;

        function dismiss(event: PointerEvent) {
            if (
                event.target instanceof Node &&
                !buttonRef.current?.contains(event.target)
            ) {
                onChange(null);
            }
        }

        document.addEventListener('pointerdown', dismiss, true);
        return () => document.removeEventListener('pointerdown', dismiss, true);
    }, [source, onChange]);

    return (
        <Tooltip
            trigger="focus"
            isOpen={source !== null}
            onOpenChange={(isOpen) => onChange(isOpen ? 'focus' : null)}
            shouldCloseOnPress={false}
            closeDelay={0}
        >
            <Pressable
                onPress={({ pointerType }) => {
                    if (pointerType === 'touch' || pointerType === 'pen') {
                        onChange(source === 'touch' ? null : 'touch');
                    } else if (
                        pointerType === 'keyboard' ||
                        pointerType === 'virtual'
                    ) {
                        onChange('focus');
                    }
                }}
            >
                <button
                    ref={buttonRef}
                    type="button"
                    aria-label={title}
                    className={buttonClassName}
                >
                    <span
                        ref={anchorRef}
                        aria-hidden="true"
                        className={`${className} flex-col-reverse`}
                        style={style}
                        onPointerEnter={(event) => {
                            if (
                                event.pointerType === 'mouse' &&
                                source !== 'focus'
                            ) {
                                onChange('hover');
                            }
                        }}
                        onPointerLeave={(event) => {
                            if (
                                event.pointerType === 'mouse' &&
                                source === 'hover'
                            ) {
                                onChange(null);
                            }
                        }}
                    >
                        {segments.map(({ id, color, seconds }) => (
                            <span
                                key={id}
                                className="min-h-0 basis-0 shadow-[inset_0_-1px_var(--surface)] first:shadow-none last:rounded-t-[4px]"
                                style={{
                                    flexGrow: seconds,
                                    backgroundColor: color,
                                }}
                            />
                        ))}
                    </span>
                </button>
            </Pressable>
            <BreakdownTooltip
                title={title}
                items={items}
                placement="right"
                triggerRef={anchorRef}
            />
        </Tooltip>
    );
}

/** Hours over time, stacked by project in reports and by billable status on project pages. */
export function TimelineChart({
    unit,
    buckets,
    title,
    projects,
    headerAction,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const axisRef = useRef<HTMLDivElement>(null);
    const [axisWidth, setAxisWidth] = useState(0);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [activeProjectBar, setActiveProjectBar] = useState<{
        unit: Props['unit'];
        key: string;
        source: TooltipSource;
    } | null>(null);
    const projectBar =
        activeProjectBar?.unit === unit ? activeProjectBar : null;
    const selected = buckets.find((bucket) => bucket.key === selectedKey);
    const activeKey = projects ? projectBar?.key : selected?.key;
    const chartTitle = title ?? t(TIMELINE_TITLES[unit]);
    const barMaxWidth = projects
        ? 'max-w-[clamp(--spacing(6),75%,--spacing(24))]'
        : 'max-w-6';
    const plotHeight = projects ? 'h-[23.625rem]' : 'h-[14.4rem]';
    const isDailyReport = Boolean(projects) && unit === 'day';
    const firstDay = buckets[0]?.key;
    const lastDay = buckets.at(-1)?.key;
    // The report uses daily buckets for at most 31 days, so this identifies a single full month.
    const showDayNumbers =
        isDailyReport &&
        !!firstDay &&
        !!lastDay &&
        isWholeMonths(firstDay, lastDay);
    const isSunday = (key: string) =>
        isDailyReport && new Date(`${key}T00:00:00Z`).getUTCDay() === 0;

    useEffect(() => {
        const axis = axisRef.current;
        if (!axis || unit === 'day') return;

        const observer = new ResizeObserver(([entry]) =>
            setAxisWidth(entry.contentRect.width),
        );
        observer.observe(axis);

        return () => observer.disconnect();
    }, [unit]);
    // In the order of the projects (largest first), not of the object's numeric keys, so every bar
    // stacks the same way with the large projects at the bottom.
    const projectHours = (bucket: TimelineBucket): ProjectHours[] =>
        (projects ?? []).flatMap((project) => {
            const seconds = bucket.projectSeconds?.[project.id] ?? 0;

            return seconds > 0 ? [{ ...project, seconds }] : [];
        });
    const { max, step } = axis(
        Math.max(0, ...buckets.map((bucket) => bucket.seconds)),
    );
    const gridlines = Array.from(
        { length: max / step + 1 },
        (_, index) => index * step,
    );
    // Reserve room for two digits per week or an abbreviated month, with a gap between labels.
    const minLabelWidth = unit === 'week' ? 20 : 40;
    const labelEvery = Math.max(
        1,
        Math.ceil(
            unit === 'day' || !axisWidth
                ? buckets.length / 8
                : (buckets.length * minLabelWidth) / axisWidth,
        ),
    );
    const hasBillable = buckets.some((bucket) => bucket.billableSeconds > 0);
    const hasNonBillable = buckets.some(
        (bucket) => bucket.seconds > bucket.billableSeconds,
    );

    const period = (bucket: TimelineBucket) =>
        formatBucket(bucket.key, unit, intlLocale, (week) =>
            t('Week :number', { number: week }),
        );
    const hours = (seconds: number) => formatDecimalHours(seconds, intlLocale);
    const describe = (bucket: TimelineBucket) =>
        `${period(bucket)}: ${hours(bucket.seconds)}`;

    const tick = (bucket: TimelineBucket) => {
        if (unit === 'week') return isoWeek(bucket.key);
        if (showDayNumbers)
            return formatDate(bucket.key, intlLocale, { day: 'numeric' });

        return formatDate(
            bucket.key,
            intlLocale,
            unit === 'month'
                ? { month: 'short' }
                : { day: 'numeric', month: 'numeric' },
        );
    };

    return (
        <section
            className="grid h-full grid-cols-1 content-between gap-3 rounded-2xl bg-surface p-4 shadow-surface"
            data-test="timeline-chart"
        >
            <div
                className={`flex items-center justify-between ${projects ? 'min-h-11 gap-2 md:min-h-10' : 'flex-wrap gap-x-4 gap-y-1'}`}
            >
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
                {headerAction}
                {!projects && (
                    <p
                        className="min-h-5 text-sm text-muted tabular-nums"
                        aria-live="polite"
                    >
                        {selected
                            ? describe(selected)
                            : t('Select a bar for details.')}
                        {selected &&
                            ` · ${t(':hours billable', { hours: hours(selected.billableSeconds) })}`}
                    </p>
                )}
            </div>

            {projects && (
                <div data-test="timeline-legend">
                    <ProjectLabels items={projects} />
                </div>
            )}

            <div
                className={
                    showDayNumbers
                        ? '-mt-2 grid min-w-0 gap-3 overflow-x-auto pt-2'
                        : 'contents'
                }
                style={
                    showDayNumbers
                        ? {
                              gridTemplateColumns: `minmax(${HOURS_AXIS_WIDTH_REM + buckets.length * DAY_COLUMN_WIDTH_REM}rem, 1fr)`,
                          }
                        : undefined
                }
            >
                <div className={`relative pl-10 ${plotHeight}`}>
                    {gridlines.map((hours) => (
                        <div
                            key={hours}
                            // Start each line at its tick coordinate, including the plot's bottom edge at zero.
                            className={`pointer-events-none absolute right-0 left-10 after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-separator ${hours === 0 ? 'z-10' : ''}`}
                            style={{ bottom: `${(hours / max) * 100}%` }}
                        >
                            <span className="absolute -top-2 -left-10 w-9 text-right text-xs whitespace-nowrap text-muted tabular-nums">
                                {hours} h
                            </span>
                        </div>
                    ))}

                    <div
                        className="relative flex h-full items-end gap-0.5 overflow-clip"
                        role="list"
                        aria-label={chartTitle}
                    >
                        {buckets.map((bucket, index) => {
                            const barStyle = {
                                height: `${(bucket.seconds / 3600 / max) * 100}%`,
                                animationDelay: `${Math.min(index * 12, 360)}ms`,
                            };
                            const barClassName = `flex w-full ${barMaxWidth} origin-bottom animate-grow-y transition-[height,opacity] duration-300 ${!activeKey || activeKey === bucket.key ? '' : 'opacity-70 group-hover:opacity-100'}`;

                            return (
                                <div
                                    key={`${unit}:${bucket.key}`}
                                    role="listitem"
                                    className={`flex h-full min-w-0 flex-1 ${isSunday(bucket.key) ? 'bg-danger/10' : ''}`}
                                >
                                    {projects ? (
                                        <ProjectTimelineBar
                                            title={`${period(bucket)} · ${hours(bucket.seconds)}`}
                                            segments={projectHours(bucket)}
                                            className={barClassName}
                                            style={barStyle}
                                            source={
                                                projectBar?.key === bucket.key
                                                    ? projectBar.source
                                                    : null
                                            }
                                            onChange={(source) =>
                                                setActiveProjectBar(
                                                    (current) =>
                                                        source
                                                            ? {
                                                                  unit,
                                                                  key: bucket.key,
                                                                  source,
                                                              }
                                                            : current?.unit ===
                                                                    unit &&
                                                                current.key ===
                                                                    bucket.key
                                                              ? null
                                                              : current,
                                                )
                                            }
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            aria-label={describe(bucket)}
                                            className={buttonClassName}
                                            onMouseEnter={() =>
                                                setSelectedKey(bucket.key)
                                            }
                                            onFocus={() =>
                                                setSelectedKey(bucket.key)
                                            }
                                            onClick={() =>
                                                setSelectedKey(bucket.key)
                                            }
                                        >
                                            <span
                                                className={`${barClassName} flex-col justify-end gap-0.5`}
                                                style={barStyle}
                                            >
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
                                            </span>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div
                    ref={axisRef}
                    className="flex gap-0.5 pl-10"
                    aria-hidden="true"
                >
                    {buckets.map((bucket, index) => (
                        <span
                            key={bucket.key}
                            className={`min-w-0 flex-1 overflow-visible text-center text-xs whitespace-nowrap tabular-nums ${isSunday(bucket.key) ? 'text-danger-soft-foreground' : 'text-muted'}`}
                        >
                            {showDayNumbers || index % labelEvery === 0
                                ? tick(bucket)
                                : ''}
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}
