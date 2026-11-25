import { Label, ListBox, RangeCalendar } from '@heroui/react';
import type { Selection } from '@heroui/react';
import {
    parseDate,
    toCalendarDate,
    today,
    toZoned,
} from '@internationalized/date';
import type { CalendarDate } from '@internationalized/date';
import { usePage } from '@inertiajs/react';
import type { KeyboardEvent } from 'react';
import type { SelectOption } from '@/components/form/select-field';
import { PeriodPicker } from '@/components/period-picker';
import { useTranslation } from '@/lib/i18n';
import { customPeriodName, shiftPeriod } from '@/lib/reports';
import { formatDate, formatDateRange } from '@/lib/time';
import { cn } from '@/lib/utils';

type PeriodChange =
    | { period: string }
    | { period: 'custom'; from: string; to: string };

type Props = {
    period: string;
    from: string;
    to: string;
    /** Preset periods ("This week", …) including "custom". */
    periods: SelectOption[];
    /** ISO weekday the organization's weeks start on (1 = Monday). */
    weekStartsOn: number;
    onChange: (changes: PeriodChange) => void;
    className?: string;
};

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

type PanelProps = Pick<Props, 'from' | 'to' | 'weekStartsOn'> & {
    presets: SelectOption[];
    preset?: SelectOption;
    isDesktop: boolean;
    timezone: string;
    onApply: (changes: PeriodChange) => void;
    onDismiss: () => void;
};

function PeriodPanel({
    from,
    to,
    weekStartsOn,
    presets,
    preset,
    isDesktop,
    timezone,
    onApply,
    onDismiss,
}: PanelProps) {
    const { t, intlLocale } = useTranslation();
    const months = isDesktop ? [0, 1] : [0];
    const range =
        from && to
            ? {
                  start: toZoned(parseDate(from), timezone),
                  end: toZoned(parseDate(to), timezone),
              }
            : null;
    const appliedRange = range
        ? formatDateRange(from, to, intlLocale, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
          })
        : preset?.label;
    const monthLabel = (date: CalendarDate) =>
        formatDate(date.toString(), intlLocale, {
            month: 'long',
            year: 'numeric',
        });

    const choosePreset = (keys: Selection) => {
        const [key] = keys === 'all' ? [] : [...keys];

        if (key !== undefined) {
            onApply({ period: String(key) });
        } else if (preset) {
            onDismiss();
        }
    };

    const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
        // The calendar also handles Escape to clear its anchor. Close the picker
        // and let the overlay return focus to its trigger.
        if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.stopPropagation();
            onDismiss();
        }
    };

    return (
        <div
            className={cn(
                'report-period-panel text-foreground',
                isDesktop && 'grid grid-cols-[198px_minmax(0,1fr)]',
            )}
            onKeyDownCapture={onKeyDownCapture}
        >
            <div
                className={cn(
                    'border-separator',
                    isDesktop
                        ? 'border-e px-3 py-2.5'
                        : 'border-b px-4 py-2.5 sm:px-5',
                )}
            >
                <ListBox
                    aria-label={t('Period presets')}
                    selectionMode="single"
                    selectionBehavior="toggle"
                    selectedKeys={preset ? [preset.value] : []}
                    onSelectionChange={choosePreset}
                    layout={isDesktop ? 'stack' : 'grid'}
                    className={cn(
                        'grid gap-y-0.5 overflow-visible p-0 *:mt-0',
                        !isDesktop && 'grid-cols-2 gap-x-2',
                    )}
                    data-test="report-period-presets"
                >
                    {presets.map((option) => (
                        <ListBox.Item
                            key={option.value}
                            id={option.value}
                            textValue={option.label}
                            className="report-period-preset min-h-9 gap-1 rounded-full px-3 py-1.5 text-foreground"
                        >
                            <Label className="text-sm/5 font-medium">
                                {option.label}
                            </Label>
                            <ListBox.ItemIndicator className="report-period-preset__indicator">
                                <span
                                    aria-hidden="true"
                                    className="report-period-icon report-period-icon--check"
                                />
                            </ListBox.ItemIndicator>
                        </ListBox.Item>
                    ))}
                </ListBox>
            </div>
            <RangeCalendar
                aria-label={t('Custom date range')}
                firstDayOfWeek={WEEKDAYS[(weekStartsOn + 6) % 7]}
                visibleDuration={{ months: months.length }}
                weeksInMonth={6}
                pageBehavior="single"
                selectionAlignment="start"
                defaultFocusedValue={range ? undefined : today(timezone)}
                value={range}
                onChange={(value) =>
                    onApply({
                        period: 'custom',
                        from: toCalendarDate(value.start).toString(),
                        to: toCalendarDate(value.end).toString(),
                    })
                }
                className="report-period-calendar w-full max-w-none min-w-0"
            >
                {({ state: { anchorDate, visibleRange, focusedDate } }) => (
                    <div data-picking-end={anchorDate ? 'true' : undefined}>
                        <div
                            className={cn(
                                'pt-3.5',
                                isDesktop ? 'px-4' : 'px-4 min-[390px]:px-5',
                            )}
                        >
                            <RangeCalendar.Header
                                className={cn(
                                    'relative grid h-9 grid-cols-1 gap-[22px] px-0 pb-0 text-center',
                                    isDesktop && 'grid-cols-2',
                                )}
                            >
                                <RangeCalendar.Heading className="sr-only" />
                                {months.map((offset) => (
                                    <span
                                        aria-hidden="true"
                                        key={offset}
                                        className="text-sm font-medium first-letter:uppercase"
                                    >
                                        {monthLabel(
                                            visibleRange.start.add({
                                                months: offset,
                                            }),
                                        )}
                                    </span>
                                ))}
                                <RangeCalendar.NavButton
                                    slot="previous"
                                    aria-label={t('Previous month')}
                                    className="absolute inset-s-0 size-9 rounded-full text-foreground"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="report-period-icon report-period-icon--previous"
                                    />
                                </RangeCalendar.NavButton>
                                <RangeCalendar.NavButton
                                    slot="next"
                                    aria-label={t('Next month')}
                                    className="absolute inset-e-0 size-9 rounded-full text-foreground"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="report-period-icon report-period-icon--next"
                                    />
                                </RangeCalendar.NavButton>
                            </RangeCalendar.Header>
                            <div
                                className={cn(
                                    'mt-1 grid gap-[22px]',
                                    isDesktop && 'grid-cols-2',
                                )}
                            >
                                {months.map((offset) => (
                                    <RangeCalendar.Grid
                                        key={offset}
                                        offset={{ months: offset }}
                                    >
                                        <RangeCalendar.GridHeader>
                                            {(day) => (
                                                <RangeCalendar.HeaderCell className="pb-0 font-normal first-letter:uppercase">
                                                    {day.replace(/\.$/, '')}
                                                </RangeCalendar.HeaderCell>
                                            )}
                                        </RangeCalendar.GridHeader>
                                        <RangeCalendar.GridBody>
                                            {(date) => (
                                                <RangeCalendar.Cell
                                                    date={date}
                                                    data-range-anchor={
                                                        anchorDate?.compare(
                                                            date,
                                                        ) === 0
                                                            ? 'true'
                                                            : undefined
                                                    }
                                                    data-range-preview-end={
                                                        anchorDate &&
                                                        anchorDate.compare(
                                                            date,
                                                        ) !== 0 &&
                                                        focusedDate.compare(
                                                            date,
                                                        ) === 0
                                                            ? 'true'
                                                            : undefined
                                                    }
                                                >
                                                    {({
                                                        formattedDate,
                                                        isOutsideMonth,
                                                        isToday,
                                                    }) => (
                                                        <>
                                                            {formattedDate}
                                                            {isToday &&
                                                                !isOutsideMonth && (
                                                                    <RangeCalendar.CellIndicator className="report-period-calendar__today" />
                                                                )}
                                                        </>
                                                    )}
                                                </RangeCalendar.Cell>
                                            )}
                                        </RangeCalendar.GridBody>
                                    </RangeCalendar.Grid>
                                ))}
                            </div>
                        </div>
                        <div
                            role="status"
                            className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-separator px-4 py-2 text-sm sm:px-5"
                        >
                            <span className="font-medium">
                                {anchorDate
                                    ? t('Start date :date', {
                                          date: formatDate(
                                              anchorDate.toString(),
                                              intlLocale,
                                              {
                                                  day: 'numeric',
                                                  month: 'long',
                                              },
                                          ),
                                      })
                                    : appliedRange}
                            </span>
                            <span className="text-muted">
                                {anchorDate
                                    ? t('Select end date')
                                    : t('Select start date')}
                            </span>
                        </div>
                    </div>
                )}
            </RangeCalendar>
        </div>
    );
}

/** The report period can be stepped, chosen from a preset or selected on the calendar. */
export function ReportPeriodPicker({
    period,
    from,
    to,
    periods,
    weekStartsOn,
    onChange,
    className,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const { timezone } = usePage().props.auth.user;
    const presets = periods.filter((option) => option.value !== 'custom');
    const preset = presets.find((option) => option.value === period);
    const hasRange = from !== '' && to !== '';
    const year = String(today(timezone).year);
    const inCurrentYear = from.startsWith(year) && to.startsWith(year);
    const range = hasRange
        ? formatDateRange(
              from,
              to,
              intlLocale,
              inCurrentYear
                  ? { day: 'numeric', month: 'short' }
                  : { day: 'numeric', month: 'short', year: 'numeric' },
          )
        : null;
    const name =
        preset?.label ??
        (hasRange
            ? customPeriodName(from, to, weekStartsOn, intlLocale, (week) =>
                  t('Week :number', { number: week }),
              )
            : null);

    const step = (direction: -1 | 1) =>
        onChange({ period: 'custom', ...shiftPeriod(from, to, direction) });

    return (
        <PeriodPicker
            name={name}
            range={range}
            onStep={hasRange ? step : undefined}
            className={className}
            testId="report-period"
        >
            {({ isDesktop, dismiss }) => (
                <PeriodPanel
                    from={from}
                    to={to}
                    weekStartsOn={weekStartsOn}
                    presets={presets}
                    preset={preset}
                    isDesktop={isDesktop}
                    timezone={timezone}
                    onApply={(changes) => {
                        dismiss();
                        onChange(changes);
                    }}
                    onDismiss={dismiss}
                />
            )}
        </PeriodPicker>
    );
}
