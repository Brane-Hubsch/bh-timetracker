import { Pressable, Tooltip } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ShortcutRow } from '@/components/form/shortcut-row';
import { ProjectDot } from '@/components/project-dot';
import { BreakdownTooltip } from '@/components/reports/breakdown-tooltip';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import { formatDecimalHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { formatBucket, isWholeMonths } from '@/lib/reports';
import { formatDate, isoWeek } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { ReportSummary, TimelineBucket, TimelineProject } from '@/types';

type Props = {
    unit: 'day' | 'week' | 'month';
    buckets: TimelineBucket[];
    title?: string;
    projects?: TimelineProject[];
    headerAction?: ReactNode;
    report?: {
        weekStartsOn: number;
        onSwipe?: (direction: -1 | 1, onFinish: () => void) => void;
        onSwipeIntent?: (direction: -1 | 1) => void;
        adjacentTimeline?: (
            direction: -1 | 1,
        ) => ReportSummary['timeline'] | undefined;
    };
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

function ProjectLabels({
    items,
    mobile,
}: {
    items: TimelineProject[];
    mobile?: boolean;
}) {
    return (
        <ShortcutRow
            contentClassName={cn('p-0', mobile && 'px-4')}
            data-test="timeline-legend"
        >
            <ul className="flex h-4 gap-4 text-xs whitespace-nowrap text-muted">
                {items.map((project) => (
                    <li
                        key={project.id}
                        className="flex shrink-0 items-center gap-1.5"
                    >
                        <ProjectDot
                            color={project.color}
                            size={mobile ? 'sm' : 'md'}
                        />
                        {projectLabel(project)}
                    </li>
                ))}
            </ul>
        </ShortcutRow>
    );
}

const buttonClassName =
    'group flex h-full w-full items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset';

// Keep subpixel rounding inside the plot so the final mobile bar stays clear of its clip edge.
const mobileTimelineColumns = 'grid auto-cols-fr grid-flow-col gap-0.5';

function ProjectSegments({ items }: { items: ProjectHours[] }) {
    return items.map(({ id, color, seconds }) => (
        <span
            key={id}
            className="min-h-0 basis-0 shadow-[inset_0_-1px_var(--surface)] first:shadow-none last:rounded-t-[4px]"
            style={{ flexGrow: seconds, backgroundColor: color }}
        />
    ));
}

// A second chart track uses the current scale while the grid and its labels stay fixed.
function AdjacentBars({
    timeline,
    max,
    labelEvery,
    renderTick,
}: {
    timeline: ReportSummary['timeline'];
    max: number;
    labelEvery: number;
    renderTick: (
        bucket: TimelineBucket,
        index: number,
        unit: Props['unit'],
        labelEvery: number,
    ) => ReactNode;
}) {
    const { buckets, projects, unit } = timeline;
    return (
        <>
            <div
                className={cn(
                    mobileTimelineColumns,
                    'h-(--plot-height) items-end overflow-clip',
                )}
            >
                {buckets.map((bucket) => (
                    <div
                        className="flex h-full items-end justify-center"
                        key={bucket.key}
                    >
                        <span
                            className="flex w-full max-w-[clamp(--spacing(6),75%,--spacing(24))] flex-col-reverse overflow-hidden rounded-t-[4px]"
                            style={{
                                height: `${Math.min(100, (bucket.seconds / 3600 / max) * 100)}%`,
                            }}
                        >
                            <ProjectSegments
                                items={projectHours(bucket, projects)}
                            />
                        </span>
                    </div>
                ))}
            </div>
            <div className={cn(mobileTimelineColumns, 'mt-3')}>
                {buckets.map((bucket, index) => (
                    <span
                        key={bucket.key}
                        className="text-center text-[11px] whitespace-nowrap text-muted tabular-nums"
                    >
                        {renderTick(bucket, index, unit, labelEvery)}
                    </span>
                ))}
            </div>
        </>
    );
}

function projectHours(
    bucket: TimelineBucket,
    projects: TimelineProject[] = [],
): ProjectHours[] {
    // Stack in project order (largest first), independently of the object's numeric keys.
    return projects.flatMap((project) => {
        const seconds = bucket.projectSeconds?.[project.id] ?? 0;
        return seconds > 0 ? [{ ...project, seconds }] : [];
    });
}

function ProjectTimelineBar({
    title,
    segments,
    className,
    style,
    source,
    onChange,
    mobile,
}: {
    title: string;
    segments: ProjectHours[];
    className: string;
    style: CSSProperties;
    source: TooltipSource | null;
    onChange: (source: TooltipSource | null) => void;
    mobile: boolean;
}) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const anchorRef = useRef<HTMLSpanElement>(null);
    const [position, setPosition] = useState<{
        placement: 'left' | 'right';
        width: number;
    }>();
    function changeSource(next: TooltipSource | null) {
        if (next && mobile && anchorRef.current) {
            const { left, right } = anchorRef.current.getBoundingClientRect();
            const spaceRight = document.documentElement.clientWidth - right;
            setPosition({
                placement: spaceRight >= left ? 'right' : 'left',
                width: Math.min(256, Math.max(left, spaceRight) - 24),
            });
        }
        onChange(next);
    }
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
            onOpenChange={(isOpen) => changeSource(isOpen ? 'focus' : null)}
            shouldCloseOnPress={false}
            closeDelay={0}
        >
            <Pressable
                onPress={({ pointerType }) => {
                    if (buttonRef.current?.closest('[data-swiping]')) return;

                    if (pointerType === 'touch' || pointerType === 'pen') {
                        changeSource(source === 'touch' ? null : 'touch');
                    } else if (
                        pointerType === 'keyboard' ||
                        pointerType === 'virtual'
                    ) {
                        changeSource('focus');
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
                        className={`${className} flex-col-reverse overflow-hidden rounded-t-[4px]`}
                        style={style}
                        onPointerEnter={(event) => {
                            if (
                                event.pointerType === 'mouse' &&
                                source !== 'focus'
                            ) {
                                changeSource('hover');
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
                        <ProjectSegments items={segments} />
                    </span>
                </button>
            </Pressable>
            <BreakdownTooltip
                title={title}
                items={
                    mobile
                        ? items.map((item) => ({ ...item, clientName: null }))
                        : items
                }
                placement={mobile ? (position?.placement ?? 'right') : 'right'}
                width={mobile ? position?.width : undefined}
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
    report,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const isDesktop = useIsDesktop();
    const mobile = Boolean(report) && !isDesktop;
    const timelineColumns = mobile ? mobileTimelineColumns : 'flex gap-0.5';
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
    const plotHeight = projects ? '23.625rem' : '14.4rem';
    const { adjacent, track, viewportProps } = useSwipeNavigation({
        onSwipe: mobile ? report?.onSwipe : undefined,
        onSwipeIntent: (direction) => {
            setActiveProjectBar(null);
            report?.onSwipeIntent?.(direction);
        },
    });
    const preview =
        adjacent && mobile ? report?.adjacentTimeline?.(adjacent) : undefined;
    const isDailyReport = Boolean(projects) && unit === 'day';
    const firstDay = buckets[0]?.key;
    const lastDay = buckets.at(-1)?.key;
    // The report uses daily buckets for at most 31 days, so this identifies a single full month.
    const showDayNumbers =
        isDailyReport &&
        !!firstDay &&
        !!lastDay &&
        isWholeMonths(firstDay, lastDay);
    const scrollDays = showDayNumbers && !mobile;
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
        mobile && unit === 'day'
            ? formatDate(bucket.key, intlLocale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
              })
            : formatBucket(bucket.key, unit, intlLocale, (week) =>
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

    function mobileTick(
        bucket: TimelineBucket,
        index: number,
        tickUnit: Props['unit'],
        stride: number,
    ) {
        if (tickUnit === 'day') {
            const weekday =
                new Date(`${bucket.key}T00:00:00Z`).getUTCDay() || 7;
            return weekday === report?.weekStartsOn
                ? Number(bucket.key.slice(-2))
                : null;
        }

        if (index % stride !== 0) return null;
        return tickUnit === 'week'
            ? isoWeek(bucket.key)
            : formatDate(bucket.key, intlLocale, { month: 'short' });
    }

    return (
        <section
            className={cn(
                'grid h-full min-w-0 grid-cols-1 content-between gap-3 rounded-2xl bg-surface p-4 shadow-surface',
                report &&
                    'max-md:gap-2 max-md:rounded-none max-md:bg-transparent max-md:p-0 max-md:pb-3 max-md:shadow-none',
                report && (headerAction ? 'max-md:pt-3' : 'max-md:pt-6'),
            )}
            data-test="timeline-chart"
        >
            <div
                className={cn(
                    'flex items-center justify-between',
                    projects
                        ? 'min-h-11 gap-2 md:min-h-10'
                        : 'flex-wrap gap-x-4 gap-y-1',
                    report && (headerAction ? 'max-md:px-4' : 'sr-only'),
                )}
            >
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <h2
                        className={cn(
                            'text-sm font-semibold',
                            report && 'max-md:text-[15px]/5',
                        )}
                    >
                        {chartTitle}
                    </h2>
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

            {projects && !report && <ProjectLabels items={projects} />}

            <div
                className={cn(
                    scrollDays
                        ? '-mt-2 grid min-w-0 gap-3 overflow-x-auto pt-2'
                        : report
                          ? 'contents md:block'
                          : 'contents',
                    report && 'md:-ml-[11px]',
                )}
                style={
                    scrollDays
                        ? {
                              gridTemplateColumns: `minmax(${HOURS_AXIS_WIDTH_REM + buckets.length * DAY_COLUMN_WIDTH_REM}rem, 1fr)`,
                          }
                        : undefined
                }
            >
                <div
                    className={cn(
                        'relative isolate pl-10',
                        report && 'max-md:pl-[34px]',
                    )}
                    style={
                        {
                            '--plot-height': mobile ? '18.75rem' : plotHeight,
                        } as CSSProperties
                    }
                >
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-(--plot-height)">
                        {gridlines.map((hours) => (
                            <div
                                key={hours}
                                // Start each line at its tick coordinate, including the plot's bottom edge at zero.
                                className={cn(
                                    'absolute right-0 left-10 after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-separator',
                                    report && 'max-md:left-[34px]',
                                )}
                                style={{ bottom: `${(hours / max) * 100}%` }}
                            >
                                <span
                                    className={cn(
                                        'absolute -top-2 -left-10 w-9 text-right text-xs whitespace-nowrap text-muted tabular-nums',
                                        report &&
                                            'max-md:-left-[26px] max-md:text-left max-md:text-[11px]',
                                    )}
                                >
                                    {hours} h
                                </span>
                            </div>
                        ))}
                    </div>
                    <div
                        {...viewportProps}
                        className={cn(
                            'relative z-10',
                            report?.onSwipe &&
                                'max-md:touch-pan-y max-md:touch-pinch-zoom',
                            mobile && 'overflow-clip',
                        )}
                    >
                        <div
                            ref={track}
                            className={cn(
                                'relative grid gap-3',
                                report && 'max-md:pr-1.5',
                            )}
                        >
                            <div
                                className={cn(
                                    timelineColumns,
                                    'relative h-(--plot-height) items-end overflow-clip',
                                )}
                                role="list"
                                aria-label={chartTitle}
                            >
                                {buckets.map((bucket) => {
                                    const barStyle = {
                                        height: `${(bucket.seconds / 3600 / max) * 100}%`,
                                    };
                                    const barClassName = `flex w-full ${barMaxWidth} ${mobile ? 'transition-opacity' : 'transition-[height,opacity]'} duration-300 ${!activeKey || activeKey === bucket.key ? '' : 'opacity-70 group-hover:opacity-100'}`;

                                    return (
                                        <div
                                            key={`${unit}:${bucket.key}`}
                                            role="listitem"
                                            className="flex h-full min-w-0 flex-1"
                                        >
                                            {projects ? (
                                                mobile &&
                                                bucket.seconds === 0 ? null : (
                                                    <ProjectTimelineBar
                                                        mobile={mobile}
                                                        title={`${period(bucket).replace(/^./u, (letter) => (mobile ? letter.toLocaleUpperCase(intlLocale) : letter))} · ${hours(bucket.seconds)}`}
                                                        segments={projectHours(
                                                            bucket,
                                                            projects,
                                                        )}
                                                        className={barClassName}
                                                        style={barStyle}
                                                        source={
                                                            projectBar?.key ===
                                                            bucket.key
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
                                                )
                                            ) : (
                                                <button
                                                    type="button"
                                                    aria-label={describe(
                                                        bucket,
                                                    )}
                                                    className={buttonClassName}
                                                    onMouseEnter={() =>
                                                        setSelectedKey(
                                                            bucket.key,
                                                        )
                                                    }
                                                    onFocus={() =>
                                                        setSelectedKey(
                                                            bucket.key,
                                                        )
                                                    }
                                                    onClick={() =>
                                                        setSelectedKey(
                                                            bucket.key,
                                                        )
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
                                                        {bucket.billableSeconds >
                                                            0 && (
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
                            <div
                                ref={axisRef}
                                className={timelineColumns}
                                aria-hidden="true"
                            >
                                {buckets.map((bucket, index) => (
                                    <span
                                        key={bucket.key}
                                        className={cn(
                                            'min-w-0 flex-1 overflow-visible text-center text-xs whitespace-nowrap tabular-nums',
                                            mobile
                                                ? 'text-[11px] text-muted'
                                                : isSunday(bucket.key)
                                                  ? 'text-danger-soft-foreground'
                                                  : 'text-muted',
                                        )}
                                    >
                                        {mobile
                                            ? mobileTick(
                                                  bucket,
                                                  index,
                                                  unit,
                                                  labelEvery,
                                              )
                                            : showDayNumbers ||
                                                index % labelEvery === 0
                                              ? tick(bucket)
                                              : ''}
                                    </span>
                                ))}
                            </div>
                            {preview && (
                                <div
                                    inert
                                    aria-hidden="true"
                                    className={cn(
                                        'absolute top-0 w-full pr-1.5',
                                        adjacent === 1
                                            ? 'left-full'
                                            : 'right-full',
                                    )}
                                >
                                    <AdjacentBars
                                        timeline={preview}
                                        max={max}
                                        labelEvery={Math.max(
                                            1,
                                            Math.ceil(
                                                (preview.buckets.length *
                                                    (preview.unit === 'week'
                                                        ? 20
                                                        : 40)) /
                                                    Math.max(1, axisWidth),
                                            ),
                                        )}
                                        renderTick={mobileTick}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {projects && report && (
                <ProjectLabels items={projects} mobile={mobile} />
            )}
        </section>
    );
}
