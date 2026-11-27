import { Button, Calendar, Drawer } from '@heroui/react';
import {
    parseDate,
    startOfWeek,
    toCalendarDate,
    toZoned,
} from '@internationalized/date';
import type { CalendarDate } from '@internationalized/date';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import { PeriodPicker } from '@/components/period-picker';
import { SegmentedControl } from '@/components/segmented-control';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import { useTranslation } from '@/lib/i18n';
import { addDays, formatDate, formatDateRange, isoWeek } from '@/lib/time';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const MONTH_DAY = { day: 'numeric', month: 'long' } as const;

type CalendarView = 'day' | 'week' | 'list';

type Props = {
    view: CalendarView;
    date: string;
    weekStart: string;
    weekStartsOn: number;
    today: string;
    timezone: string;
    onChange: (date: string) => void;
    onViewChange: (view: CalendarView) => void;
};

type GridProps = {
    focusedDate: CalendarDate;
    firstDay: (typeof WEEKDAYS)[number];
    today: string;
    value: string;
    onChange: Props['onChange'];
};

function DayGrid({
    focusedDate,
    firstDay,
    today,
    value,
    timezone,
    onChange,
    onFocusChange,
}: GridProps & {
    timezone: string;
    onFocusChange: (day: CalendarDate) => void;
}) {
    const { t } = useTranslation();

    return (
        <Calendar
            aria-label={t('Date')}
            firstDayOfWeek={firstDay}
            value={toZoned(parseDate(value), timezone)}
            focusedValue={focusedDate}
            onFocusChange={onFocusChange}
            onChange={(day) => onChange(toCalendarDate(day).toString())}
            className="w-full max-w-none"
        >
            <Calendar.Grid className="mt-1 gap-y-px">
                <Calendar.GridHeader>
                    {(day) => (
                        <Calendar.HeaderCell className="h-7 content-center pb-0 font-normal first-letter:uppercase">
                            {day.replace(/\.$/, '')}
                        </Calendar.HeaderCell>
                    )}
                </Calendar.GridHeader>
                <Calendar.GridBody>
                    {(day) => {
                        const date = day.toString();
                        const isToday = date === today;

                        return (
                            <Calendar.Cell
                                date={day}
                                className={cn(
                                    'mx-auto size-9 rounded-full',
                                    isToday && 'bg-transparent text-foreground',
                                    date === value &&
                                        'bg-accent/15 text-foreground',
                                )}
                            >
                                {({ formattedDate }) => (
                                    <>
                                        {formattedDate}
                                        {isToday && (
                                            <Calendar.CellIndicator className="size-1 bg-accent!" />
                                        )}
                                    </>
                                )}
                            </Calendar.Cell>
                        );
                    }}
                </Calendar.GridBody>
            </Calendar.Grid>
        </Calendar>
    );
}

function WeekGrid({
    focusedDate,
    firstDay,
    today,
    value,
    onChange,
}: GridProps) {
    const { t, intlLocale } = useTranslation();
    const month = focusedDate.set({ day: 1 });
    const firstWeek = startOfWeek(month, intlLocale, firstDay);
    const nextMonth = month.add({ months: 1 });
    const weeks = Array.from({ length: 6 }, (_, index) =>
        firstWeek.add({ weeks: index }),
    ).filter((week) => week.compare(nextMonth) < 0);

    return (
        <>
            <div
                aria-hidden
                className="mt-1 grid h-7 grid-cols-7 items-center text-center text-xs text-muted"
            >
                {WEEKDAYS.map((_, index) => {
                    const day = firstWeek.add({ days: index }).toString();

                    return (
                        <span key={day} className="first-letter:uppercase">
                            {formatDate(day, intlLocale, {
                                weekday: 'short',
                            }).replace(/\.$/, '')}
                        </span>
                    );
                })}
            </div>
            <div
                className="mt-1 grid gap-px"
                role="group"
                aria-label={t('Weeks')}
            >
                {weeks.map((week) => {
                    const start = week.toString();
                    const end = week.add({ days: 6 }).toString();
                    const isCurrentWeek = start <= today && today <= end;
                    const name = t('Week :number', { number: isoWeek(start) });
                    const range = formatDateRange(start, end, intlLocale, {
                        ...MONTH_DAY,
                        year: 'numeric',
                    });
                    const todayLabel = isCurrentWeek
                        ? `, ${t('Today')} ${parseDate(today).day}`
                        : '';

                    return (
                        <Button
                            key={start}
                            variant="ghost"
                            aria-label={`${name}, ${range}${todayLabel}`}
                            aria-pressed={start === value}
                            className="grid h-9 w-full grid-cols-7 gap-0 px-0 text-foreground tabular-nums aria-pressed:bg-accent/15 data-focus-visible:bg-default data-hovered:bg-default"
                            onPress={() =>
                                onChange(isCurrentWeek ? today : start)
                            }
                        >
                            {WEEKDAYS.map((_, index) => {
                                const day = week.add({ days: index });
                                const isToday = day.toString() === today;

                                return (
                                    <span
                                        key={day.toString()}
                                        aria-hidden
                                        data-today={isToday || undefined}
                                        className={cn(
                                            'relative justify-self-stretch text-center',
                                            day.month !== month.month &&
                                                'text-muted',
                                            isToday &&
                                                'font-semibold text-foreground after:absolute after:-bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-accent after:content-[""]',
                                        )}
                                    >
                                        {day.day}
                                    </span>
                                );
                            })}
                        </Button>
                    );
                })}
            </div>
        </>
    );
}

type Preset = { label: string; date: string; value: string };

function PickerBody({
    value,
    view,
    timezone,
    weekStartsOn,
    today,
    presets,
    onChange,
}: Pick<Props, 'view' | 'today' | 'timezone' | 'weekStartsOn' | 'onChange'> & {
    value: string;
    presets: Preset[];
}) {
    const { t, intlLocale } = useTranslation();
    const isDay = view === 'day';
    const [focusedDate, setFocusedDate] = useState(() =>
        parseDate(value).add({ days: isDay ? 0 : 3 }),
    );
    const firstDay = WEEKDAYS[weekStartsOn - 1];
    const gridProps = { firstDay, today, value, onChange };
    const stepMonth = (direction: -1 | 1) =>
        setFocusedDate((day) => day.add({ months: direction }));
    const { adjacent, track, viewportProps } = useSwipeNavigation({
        onSwipe: (direction, finish) => {
            stepMonth(direction);
            finish();
        },
    });
    const renderGrid = (month: CalendarDate) =>
        isDay ? (
            <DayGrid
                {...gridProps}
                focusedDate={month}
                timezone={timezone}
                onFocusChange={setFocusedDate}
            />
        ) : (
            <WeekGrid {...gridProps} focusedDate={month} />
        );

    return (
        <div className="md:grid md:grid-cols-[212px_minmax(0,1fr)]">
            <div
                role="group"
                aria-label={t(isDay ? 'Date presets' : 'Week presets')}
                className={cn(
                    'grid content-start gap-x-2 gap-y-0.5 border-b border-separator px-4 py-3.5 min-[390px]:px-5 md:grid-cols-1 md:border-e md:border-b-0 md:px-4',
                    isDay ? 'grid-cols-3' : 'grid-cols-2',
                )}
            >
                {presets.map((preset) => (
                    <Button
                        key={preset.date}
                        variant="ghost"
                        aria-pressed={preset.value === value}
                        className={cn(
                            'h-9 w-full px-3 text-foreground aria-pressed:bg-accent/15',
                            isDay
                                ? 'justify-center max-md:px-2 md:justify-start'
                                : 'justify-start',
                        )}
                        onPress={() => onChange(preset.date)}
                    >
                        {preset.label}
                    </Button>
                ))}
            </div>
            <div className="min-w-0 px-4 pt-4 pb-5 min-[390px]:px-5 md:px-6">
                <div className="flex h-9 items-center justify-between gap-2">
                    <h3
                        aria-live="polite"
                        className="text-sm font-medium first-letter:uppercase"
                    >
                        {formatDate(focusedDate.toString(), intlLocale, {
                            month: 'long',
                            year: 'numeric',
                        })}
                    </h3>
                    <div className="flex shrink-0 items-center">
                        <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            aria-label={t('Previous month')}
                            onPress={() => stepMonth(-1)}
                        >
                            <ChevronLeft className="size-4" aria-hidden />
                        </Button>
                        <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            aria-label={t('Next month')}
                            onPress={() => stepMonth(1)}
                        >
                            <ChevronRight className="size-4" aria-hidden />
                        </Button>
                    </div>
                </div>
                <div
                    {...viewportProps}
                    className="group/month touch-pan-y touch-pinch-zoom overflow-clip"
                >
                    <div
                        ref={track}
                        className="relative group-data-[swiping]/month:pointer-events-none"
                    >
                        {renderGrid(focusedDate)}
                        {adjacent && (
                            <div
                                inert
                                aria-hidden="true"
                                className={cn(
                                    'absolute top-0 w-full',
                                    adjacent === 1 ? 'left-full' : 'right-full',
                                )}
                            >
                                {renderGrid(
                                    focusedDate.add({ months: adjacent }),
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function CalendarPicker({
    view,
    date,
    weekStart,
    weekStartsOn,
    today,
    timezone,
    onChange,
    onViewChange,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const isDay = view === 'day';
    const isList = view === 'list';
    const value = isDay ? date : weekStart;
    const currentPeriod = isDay
        ? today
        : startOfWeek(
              parseDate(today),
              intlLocale,
              WEEKDAYS[weekStartsOn - 1],
          ).toString();
    const offsets = isDay
        ? [
              { label: 'Yesterday', offset: -1 },
              { label: 'Today', offset: 0 },
              { label: 'Tomorrow', offset: 1 },
          ]
        : [
              { label: 'Last week', offset: -7 },
              { label: 'This week', offset: 0 },
              { label: 'Next week', offset: 7 },
          ];
    const presets = offsets.map(({ label, offset }) => ({
        label: t(label),
        date: addDays(today, offset),
        value: addDays(currentPeriod, offset),
    }));
    const name =
        presets.find((preset) => preset.value === value)?.label ??
        (isDay
            ? formatDate(date, intlLocale, { weekday: 'long' })
            : t('Week :number', { number: isoWeek(weekStart) }));
    const end = addDays(weekStart, 6);
    const currentYear = today.slice(0, 4);
    const lastDay = isDay ? date : end;
    const year =
        value.slice(0, 4) === currentYear && lastDay.slice(0, 4) === currentYear
            ? undefined
            : 'numeric';
    const fullRange = isDay
        ? formatDate(date, intlLocale, {
              ...MONTH_DAY,
              weekday: 'long',
              year,
          })
        : formatDateRange(weekStart, end, intlLocale, {
              ...MONTH_DAY,
              year,
          });
    const compactFormat = {
        day: 'numeric',
        month: 'short',
        year,
    } as const;
    const range = isDay
        ? formatDate(date, intlLocale, compactFormat)
        : formatDateRange(weekStart, end, intlLocale, compactFormat);
    const label = t(isList ? 'Choose a week' : 'Choose a date or week');

    return (
        <PeriodPicker
            name={name}
            range={range}
            onStep={(direction) =>
                onChange(addDays(date, direction * (isDay ? 1 : 7)))
            }
            stepLabels={
                isDay
                    ? [t('Previous day'), t('Next day')]
                    : [t('Previous week'), t('Next week')]
            }
            label={label}
            compact
            enclosed
            mobileLabelOnly
            className="min-w-0"
            testId="calendar-period-picker"
        >
            {({ isDesktop, dismiss }) => {
                const select = (day: string) => {
                    dismiss();
                    onChange(day);
                };
                const compactRange = !isDesktop;

                return (
                    <>
                        <div className="flex min-w-0 items-center justify-between gap-2 border-b border-separator px-4 py-3 max-[359px]:flex-wrap min-[390px]:px-5">
                            <p
                                className={cn(
                                    'min-w-0 font-semibold first-letter:uppercase',
                                    compactRange
                                        ? 'text-xs wrap-anywhere text-foreground min-[360px]:text-sm'
                                        : 'text-base',
                                )}
                                aria-live="polite"
                            >
                                {compactRange ? (
                                    <>
                                        <span className="sr-only">
                                            {fullRange}
                                        </span>
                                        <span aria-hidden>{range}</span>
                                    </>
                                ) : (
                                    fullRange
                                )}
                            </p>
                            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    aria-label={t('Go to today')}
                                    onPress={() => select(today)}
                                >
                                    {t('Today')}
                                </Button>
                                {(!isList || !isDesktop) && (
                                    <SegmentedControl<CalendarView>
                                        aria-label={t('View')}
                                        className="max-md:gap-0 max-md:p-[3px] max-md:[&>button]:px-2.5 max-md:[&>button[data-selected=true]]:bg-accent-soft max-md:[&>button[data-selected=true]]:shadow-none"
                                        value={view}
                                        onChange={(view) => {
                                            if (!isDesktop) {
                                                dismiss();
                                            }
                                            onViewChange(view);
                                        }}
                                        options={[
                                            { id: 'day', label: t('Day') },
                                            { id: 'week', label: t('Week') },
                                            ...(isList && !isDesktop
                                                ? [
                                                      {
                                                          id: 'list' as const,
                                                          label: t('List'),
                                                      },
                                                  ]
                                                : []),
                                        ]}
                                        data-test="calendar-picker-view"
                                    />
                                )}
                                {!isDesktop && (
                                    <Drawer.CloseTrigger
                                        aria-label={t('Close')}
                                        className="static size-9 rounded-full bg-transparent hover:bg-transparent"
                                    >
                                        <X className="size-4" aria-hidden />
                                    </Drawer.CloseTrigger>
                                )}
                            </div>
                        </div>
                        <PickerBody
                            view={view}
                            value={value}
                            today={today}
                            timezone={timezone}
                            weekStartsOn={weekStartsOn}
                            presets={presets}
                            onChange={select}
                        />
                    </>
                );
            }}
        </PeriodPicker>
    );
}
