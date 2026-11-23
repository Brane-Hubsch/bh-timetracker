import { Button, Drawer, Popover } from '@heroui/react';
import { parseDate, startOfWeek } from '@internationalized/date';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useTranslation } from '@/lib/i18n';
import { addDays, formatDate, formatDateRange, isoWeek } from '@/lib/time';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

type Props = {
    weekStart: string;
    weekStartsOn: number;
    today: string;
    onChange: (date: string) => void;
};

type WeekPreset = { label: string; date: string; start: string };

function WeekPanel({
    weekStart,
    weekStartsOn,
    today,
    onChange,
    presets,
}: Props & { presets: WeekPreset[] }) {
    const { t, intlLocale } = useTranslation();
    const [month, setMonth] = useState(() =>
        parseDate(weekStart).add({ days: 3 }).set({ day: 1 }),
    );
    const firstDay = WEEKDAYS[weekStartsOn - 1];
    const todayDate = parseDate(today);
    const firstWeek = startOfWeek(month, intlLocale, firstDay);
    const nextMonth = month.add({ months: 1 });
    const weeks = Array.from({ length: 6 }, (_, index) =>
        firstWeek.add({ weeks: index }),
    ).filter((week) => week.compare(nextMonth) < 0);
    const longRange = (start: string, end: string) =>
        formatDateRange(start, end, intlLocale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });

    return (
        <div className="sm:grid sm:grid-cols-[198px_minmax(0,1fr)]">
            <div
                role="group"
                aria-label={t('Week presets')}
                className="grid grid-cols-2 content-start gap-x-2 gap-y-0.5 border-b border-separator px-4 py-2.5 sm:grid-cols-1 sm:border-e sm:border-b-0 sm:px-3"
            >
                {presets.map(({ label, date, start }) => (
                    <Button
                        key={date}
                        variant="ghost"
                        aria-pressed={start === weekStart}
                        className="h-9 w-full justify-start px-3 text-foreground aria-pressed:bg-accent/15"
                        onPress={() => onChange(date)}
                    >
                        {label}
                    </Button>
                ))}
            </div>
            <div>
                <div className="px-4 pt-3.5 min-[390px]:px-5 sm:px-3.5">
                    <div className="flex h-9 items-center justify-between gap-1">
                        <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            aria-label={t('Previous month')}
                            onPress={() =>
                                setMonth((value) =>
                                    value.subtract({ months: 1 }),
                                )
                            }
                        >
                            <ChevronLeft className="size-4" aria-hidden />
                        </Button>
                        <h3
                            aria-live="polite"
                            className="text-sm font-medium first-letter:uppercase"
                        >
                            {formatDate(month.toString(), intlLocale, {
                                month: 'long',
                                year: 'numeric',
                            })}
                        </h3>
                        <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            aria-label={t('Next month')}
                            onPress={() =>
                                setMonth((value) => value.add({ months: 1 }))
                            }
                        >
                            <ChevronRight className="size-4" aria-hidden />
                        </Button>
                    </div>
                    <div
                        aria-hidden
                        className="mt-1 grid h-7 grid-cols-7 items-center text-center text-xs text-muted"
                    >
                        {WEEKDAYS.map((_, index) => {
                            const day = firstWeek
                                .add({ days: index })
                                .toString();

                            return (
                                <span
                                    key={day}
                                    className="first-letter:uppercase"
                                >
                                    {formatDate(day, intlLocale, {
                                        weekday: 'short',
                                    }).replace(/\.$/, '')}
                                </span>
                            );
                        })}
                    </div>
                    <div
                        className="grid gap-px"
                        role="group"
                        aria-label={t('Weeks')}
                    >
                        {weeks.map((week) => {
                            const start = week.toString();
                            const end = week.add({ days: 6 }).toString();
                            const isCurrentWeek =
                                start <= today && today <= end;
                            const name = t('Week :number', {
                                number: isoWeek(start),
                            });
                            const range = longRange(start, end);
                            const todayLabel = isCurrentWeek
                                ? `, ${t('Today')} ${todayDate.day}`
                                : '';

                            return (
                                <Button
                                    key={start}
                                    variant="ghost"
                                    aria-label={`${name}, ${range}${todayLabel}`}
                                    aria-pressed={start === weekStart}
                                    className="grid h-9 w-full grid-cols-7 gap-0 px-0 text-foreground tabular-nums aria-pressed:bg-accent/15 data-focus-visible:bg-default data-hovered:bg-default"
                                    onPress={() =>
                                        onChange(isCurrentWeek ? today : start)
                                    }
                                >
                                    {WEEKDAYS.map((_, index) => {
                                        const day = week.add({ days: index });
                                        const isToday =
                                            day.compare(todayDate) === 0;

                                        return (
                                            <span
                                                key={day.toString()}
                                                aria-hidden
                                                data-today={
                                                    isToday || undefined
                                                }
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
                </div>
                <div className="mt-4 flex min-h-11 items-center justify-between gap-2 border-t border-separator px-4 py-1.5">
                    <span className="text-sm font-medium">
                        {longRange(weekStart, addDays(weekStart, 6))}
                    </span>
                    <Button
                        variant="secondary"
                        size="sm"
                        aria-label={t('Go to today')}
                        onPress={() => setMonth(todayDate.set({ day: 1 }))}
                    >
                        {t('Today')}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function WeekPicker(props: Props) {
    const { t, intlLocale } = useTranslation();
    const isDesktop = useMediaQuery('(min-width: 640px)');
    const [isOpen, setIsOpen] = useState(false);
    const { weekStart, weekStartsOn, today } = props;
    const currentWeek = startOfWeek(
        parseDate(today),
        intlLocale,
        WEEKDAYS[weekStartsOn - 1],
    ).toString();
    const presets = [
        { label: t('This week'), offset: 0 },
        { label: t('Last week'), offset: -7 },
        { label: t('Next week'), offset: 7 },
    ].map(({ label, offset }) => ({
        label,
        date: addDays(today, offset),
        start: addDays(currentWeek, offset),
    }));
    const name =
        presets.find(({ start }) => start === weekStart)?.label ??
        t('Week :number', { number: isoWeek(weekStart) });
    const range = formatDateRange(
        weekStart,
        addDays(weekStart, 6),
        intlLocale,
        {
            day: 'numeric',
            month: 'long',
        },
    );

    const trigger = (
        <Button
            variant="secondary"
            size="sm"
            className="h-10 min-w-[8.25rem] flex-col gap-0 text-center text-foreground"
            data-test="calendar-week-picker"
        >
            <span className="text-sm/4 font-semibold">{name}</span>
            <span className="text-xs/3.5 font-normal whitespace-nowrap text-muted tabular-nums">
                {range}
            </span>
        </Button>
    );
    const panel = (
        <WeekPanel
            {...props}
            presets={presets}
            onChange={(date) => {
                setIsOpen(false);
                props.onChange(date);
            }}
        />
    );

    return isDesktop ? (
        <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
            {trigger}
            <Popover.Content
                placement="bottom start"
                offset={8}
                className="w-[450px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-separator bg-surface p-0"
            >
                <Popover.Dialog aria-label={t('Choose a week')} className="p-0">
                    {panel}
                </Popover.Dialog>
            </Popover.Content>
        </Popover>
    ) : (
        <Drawer isOpen={isOpen} onOpenChange={setIsOpen}>
            {trigger}
            <Drawer.Backdrop variant="opaque">
                <Drawer.Content placement="bottom">
                    <Drawer.Dialog className="max-h-[92svh] bg-surface p-0">
                        <Drawer.Handle className="pt-2 pb-0" />
                        <Drawer.Header className="flex-row items-center justify-between border-b border-separator px-5 py-1.5">
                            <Drawer.Heading className="font-semibold">
                                {t('Choose a week')}
                            </Drawer.Heading>
                            <Drawer.CloseTrigger
                                aria-label={t('Close')}
                                className="static size-10 rounded-full bg-transparent hover:bg-transparent"
                            >
                                <X className="size-4" aria-hidden />
                            </Drawer.CloseTrigger>
                        </Drawer.Header>
                        <Drawer.Body className="m-0! p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                            {panel}
                        </Drawer.Body>
                    </Drawer.Dialog>
                </Drawer.Content>
            </Drawer.Backdrop>
        </Drawer>
    );
}
