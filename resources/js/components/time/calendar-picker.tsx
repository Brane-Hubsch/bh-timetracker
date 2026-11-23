import { Button, Calendar, Drawer, Popover } from '@heroui/react';
import {
    parseDate,
    startOfWeek,
    toCalendarDate,
    toZoned,
} from '@internationalized/date';
import type { CalendarDate } from '@internationalized/date';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import { SegmentedControl } from '@/components/segmented-control';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useTranslation } from '@/lib/i18n';
import { addDays, formatDate, formatDateRange, isoWeek } from '@/lib/time';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const MONTH_DAY = { day: 'numeric', month: 'long' } as const;
const FULL_DATE = { ...MONTH_DAY, weekday: 'long', year: 'numeric' } as const;

type CalendarView = 'day' | 'week';

type Props = {
    view: CalendarView | 'list';
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
    const gridProps = { focusedDate, firstDay, today, value, onChange };

    return (
        <div className="sm:grid sm:grid-cols-[212px_minmax(0,1fr)]">
            <div
                role="group"
                aria-label={t(isDay ? 'Date presets' : 'Week presets')}
                className="grid grid-cols-2 content-start gap-x-2 gap-y-0.5 border-b border-separator px-4 py-3.5 min-[390px]:px-5 sm:grid-cols-1 sm:border-e sm:border-b-0 sm:px-4"
            >
                {presets.map((preset) => (
                    <Button
                        key={preset.date}
                        variant="ghost"
                        aria-pressed={preset.value === value}
                        className="h-9 w-full justify-start px-3 text-foreground aria-pressed:bg-accent/15"
                        onPress={() => onChange(preset.date)}
                    >
                        {preset.label}
                    </Button>
                ))}
            </div>
            <div className="min-w-0 px-4 pt-4 pb-5 min-[390px]:px-5 sm:px-6">
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
                            onPress={() =>
                                setFocusedDate((day) =>
                                    day.subtract({ months: 1 }),
                                )
                            }
                        >
                            <ChevronLeft className="size-4" aria-hidden />
                        </Button>
                        <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            aria-label={t('Next month')}
                            onPress={() =>
                                setFocusedDate((day) => day.add({ months: 1 }))
                            }
                        >
                            <ChevronRight className="size-4" aria-hidden />
                        </Button>
                    </div>
                </div>
                {isDay ? (
                    <DayGrid
                        {...gridProps}
                        timezone={timezone}
                        onFocusChange={setFocusedDate}
                    />
                ) : (
                    <WeekGrid {...gridProps} />
                )}
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
    const isDesktop = useMediaQuery('(min-width: 640px)');
    const [isOpen, setIsOpen] = useState(false);
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
              { label: 'Today', offset: 0 },
              { label: 'Yesterday', offset: -1 },
              { label: 'Tomorrow', offset: 1 },
          ]
        : [
              { label: 'This week', offset: 0 },
              { label: 'Last week', offset: -7 },
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
    const range = isDay
        ? formatDate(date, intlLocale, MONTH_DAY)
        : formatDateRange(weekStart, end, intlLocale, MONTH_DAY);
    const fullRange = isDay
        ? formatDate(date, intlLocale, FULL_DATE)
        : formatDateRange(weekStart, end, intlLocale, {
              ...MONTH_DAY,
              year: 'numeric',
          });
    const compactFormat = {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    } as const;
    const compactRange =
        !isDesktop && !isList
            ? isDay
                ? formatDate(date, intlLocale, compactFormat)
                : formatDateRange(weekStart, end, intlLocale, compactFormat)
            : null;
    const label = t(isList ? 'Choose a week' : 'Choose a date or week');

    const select = (day: string) => {
        setIsOpen(false);
        onChange(day);
    };
    const trigger = (
        <Button
            variant="secondary"
            size="sm"
            className="h-10 min-w-[8.25rem] flex-col gap-0 text-center text-foreground"
            data-test="calendar-period-picker"
        >
            <span className="text-sm/4 font-semibold first-letter:uppercase">
                {name}
            </span>
            <span className="text-[0.6875rem]/3.5 font-normal whitespace-nowrap text-muted tabular-nums">
                {range}
            </span>
        </Button>
    );

    const header = (
        <div className="flex min-w-0 items-center justify-between gap-2 border-b border-separator px-4 py-3 min-[390px]:px-5">
            <p
                className={cn(
                    'min-w-0 font-semibold first-letter:uppercase',
                    compactRange
                        ? 'text-xs wrap-anywhere min-[360px]:text-sm'
                        : 'text-base',
                )}
                aria-live="polite"
            >
                {compactRange ? (
                    <>
                        <span className="sr-only">{fullRange}</span>
                        <span aria-hidden>{compactRange}</span>
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
                {!isList && (
                    <SegmentedControl
                        aria-label={t('View')}
                        value={view}
                        onChange={onViewChange}
                        options={[
                            { id: 'day', label: t('Day') },
                            { id: 'week', label: t('Week') },
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
    );
    const panel = (
        <PickerBody
            view={view}
            value={value}
            today={today}
            timezone={timezone}
            weekStartsOn={weekStartsOn}
            presets={presets}
            onChange={select}
        />
    );

    return isDesktop ? (
        <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
            {trigger}
            <Popover.Content
                placement="bottom start"
                offset={8}
                className="w-[560px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-separator bg-surface p-0"
            >
                <Popover.Dialog aria-label={label} className="p-0">
                    {header}
                    {panel}
                </Popover.Dialog>
            </Popover.Content>
        </Popover>
    ) : (
        <Drawer isOpen={isOpen} onOpenChange={setIsOpen}>
            {trigger}
            <Drawer.Backdrop variant="opaque">
                <Drawer.Content placement="bottom" className="max-w-dvw">
                    <Drawer.Dialog className="max-h-[92svh] bg-surface p-0">
                        <Drawer.Handle className="pt-2 pb-0" />
                        <Drawer.Heading className="sr-only">
                            {label}
                        </Drawer.Heading>
                        <Drawer.Body className="m-0! p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                            {header}
                            {panel}
                        </Drawer.Body>
                    </Drawer.Dialog>
                </Drawer.Content>
            </Drawer.Backdrop>
        </Drawer>
    );
}
