import { Button, Label, ListBox, Popover, RangeCalendar } from '@heroui/react';
import type { Selection } from '@heroui/react';
import { parseDate } from '@internationalized/date';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { SelectOption } from '@/components/form/select-field';
import { useTranslation } from '@/lib/i18n';
import { customPeriodName, shiftPeriod } from '@/lib/reports';
import { formatDateRange } from '@/lib/time';
import { cn } from '@/lib/utils';

type Props = {
    period: string;
    from: string;
    to: string;
    /** Preset periods ("This week", …) including "custom". */
    periods: SelectOption[];
    /** ISO weekday the organization's weeks start on (1 = Monday). */
    weekStartsOn: number;
    onChange: (
        changes:
            | { period: string }
            | { period: 'custom'; from: string; to: string },
    ) => void;
    className?: string;
};

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/**
 * The report period as one control: step to the previous or next period with the arrows, or open
 * it to pick a preset or any range in a calendar.
 */
export function PeriodPicker({
    period,
    from,
    to,
    periods,
    weekStartsOn,
    onChange,
    className,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const presets = periods.filter((option) => option.value !== 'custom');
    const preset = presets.find((option) => option.value === period);
    const sameYear =
        from.slice(0, 4) === to.slice(0, 4) &&
        from.slice(0, 4) === String(new Date().getFullYear());
    const range = formatDateRange(
        from,
        to,
        intlLocale,
        sameYear
            ? { day: 'numeric', month: 'short' }
            : { day: 'numeric', month: 'short', year: 'numeric' },
    );
    const name =
        preset?.label ??
        customPeriodName(from, to, weekStartsOn, intlLocale, (week) =>
            t('Week :number', { number: week }),
        );

    const step = (direction: -1 | 1) =>
        onChange({ period: 'custom', ...shiftPeriod(from, to, direction) });

    const choosePreset = (keys: Selection) => {
        const [key] = keys === 'all' ? [] : [...keys];

        if (key !== undefined) {
            setIsOpen(false);
            onChange({ period: String(key) });
        }
    };

    return (
        <div className={cn('flex items-center gap-1', className)}>
            <Button
                isIconOnly
                variant="ghost"
                size="sm"
                aria-label={t('Previous period')}
                onPress={() => step(-1)}
                data-test="report-period-previous"
            >
                <ChevronLeft className="size-4" />
            </Button>
            <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
                <Button
                    variant="outline"
                    className="h-9 min-w-0 flex-1 justify-between gap-2 rounded-full bg-surface ps-3.5 pe-2.5 md:flex-none"
                    data-test="report-period"
                >
                    <span className="flex min-w-0 items-baseline gap-2">
                        {name && (
                            <span className="truncate font-semibold first-letter:uppercase">
                                {name}
                            </span>
                        )}
                        <span
                            className={cn(
                                'truncate tabular-nums',
                                name ? 'font-normal text-muted' : 'font-medium',
                            )}
                        >
                            {range}
                        </span>
                    </span>
                    <ChevronDown
                        aria-hidden="true"
                        className="size-4 shrink-0"
                    />
                </Button>
                <Popover.Content
                    placement="bottom start"
                    className="max-w-[calc(100vw-2rem)] rounded-2xl p-0"
                >
                    <Popover.Dialog
                        aria-label={t('Period')}
                        className="flex flex-col gap-2 p-2 sm:flex-row"
                    >
                        <ListBox
                            aria-label={t('Period')}
                            selectionMode="single"
                            escapeKeyBehavior="none"
                            selectedKeys={
                                preset ? new Set([preset.value]) : new Set()
                            }
                            onSelectionChange={choosePreset}
                            className="sm:w-44"
                            data-test="report-period-presets"
                        >
                            {presets.map((option) => (
                                <ListBox.Item
                                    key={option.value}
                                    id={option.value}
                                    textValue={option.label}
                                >
                                    <Label>{option.label}</Label>
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                        <div
                            aria-hidden="true"
                            className="h-px bg-separator sm:h-auto sm:w-px"
                        />
                        <RangeCalendar
                            aria-label={t('Period')}
                            firstDayOfWeek={WEEKDAYS[(weekStartsOn + 6) % 7]}
                            defaultFocusedValue={parseDate(to)}
                            value={{
                                start: parseDate(from),
                                end: parseDate(to),
                            }}
                            onChange={(value) => {
                                setIsOpen(false);
                                onChange({
                                    period: 'custom',
                                    from: value.start.toString(),
                                    to: value.end.toString(),
                                });
                            }}
                            className="self-center"
                        >
                            <RangeCalendar.Header>
                                <RangeCalendar.Heading className="first-letter:uppercase" />
                                <RangeCalendar.NavButton slot="previous" />
                                <RangeCalendar.NavButton slot="next" />
                            </RangeCalendar.Header>
                            <RangeCalendar.Grid>
                                <RangeCalendar.GridHeader>
                                    {(day) => (
                                        <RangeCalendar.HeaderCell>
                                            {day}
                                        </RangeCalendar.HeaderCell>
                                    )}
                                </RangeCalendar.GridHeader>
                                <RangeCalendar.GridBody>
                                    {(date) => (
                                        <RangeCalendar.Cell date={date} />
                                    )}
                                </RangeCalendar.GridBody>
                            </RangeCalendar.Grid>
                        </RangeCalendar>
                    </Popover.Dialog>
                </Popover.Content>
            </Popover>
            <Button
                isIconOnly
                variant="ghost"
                size="sm"
                aria-label={t('Next period')}
                onPress={() => step(1)}
                data-test="report-period-next"
            >
                <ChevronRight className="size-4" />
            </Button>
        </div>
    );
}
