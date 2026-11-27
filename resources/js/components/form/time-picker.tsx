import { Button, ListBox, Popover } from '@heroui/react';
import { ChevronDown, Keyboard } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ResponsiveDialog } from '@/components/responsive-dialog';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useOverlayData } from '@/hooks/use-overlay-data';
import { useTranslation } from '@/lib/i18n';
import { formatDuration, minutesToTime } from '@/lib/time';
import { cn } from '@/lib/utils';

type Props = {
    title: string;
    mode: 'clock' | 'duration';
    value: number | null;
    defaultMinutes: number;
    onChange: (minutes: number) => void;
    onOpenChange?: (open: boolean) => void;
    onEdit: () => void;
    preview?: (minutes: number) => string | undefined;
};

const quarters = [0, 15, 30, 45];
const clockHours = Array.from({ length: 24 }, (_, hour) => hour);
const durationHours = [...clockHours, 24];
const fullDayMinutes = 24 * 60;

const pad = (value: number) => String(value).padStart(2, '0');

function rowHeight(list: HTMLDivElement) {
    return list.querySelector<HTMLElement>('[role="option"]')?.offsetHeight;
}

function TimeColumn({
    label,
    options,
    value,
    onChange,
    wheel,
    padded,
}: {
    label: string;
    options: number[];
    value: number;
    onChange: (value: number) => void;
    wheel: boolean;
    padded: boolean;
}) {
    const alignedValue = useRef<number | null>(null);

    function alignList(list: HTMLDivElement | null) {
        if (
            !list ||
            alignedValue.current === value ||
            (!wheel && alignedValue.current !== null)
        ) {
            return;
        }

        // Wait for React Aria to render its collection in the portalled list.
        const frame = requestAnimationFrame(() => {
            const height = rowHeight(list);
            if (!height) return;

            const index = options.indexOf(value);
            alignedValue.current = value;
            list.scrollTop = Math.max(0, index - (wheel ? 0 : 1)) * height;
        });

        return () => cancelAnimationFrame(frame);
    }

    return (
        <div className="grid min-w-0 content-start gap-2">
            <span
                aria-hidden="true"
                className={cn(
                    'text-xs font-medium text-muted',
                    wheel && 'text-center text-sm',
                )}
            >
                {label}
            </span>
            <ListBox
                ref={alignList}
                aria-label={label}
                selectionMode="single"
                selectionBehavior="replace"
                disallowEmptySelection
                escapeKeyBehavior="none"
                selectedKeys={[value]}
                onSelectionChange={(keys) => {
                    if (keys === 'all') return;
                    const [selected] = keys;
                    if (typeof selected === 'number') onChange(selected);
                }}
                onScroll={
                    wheel
                        ? ({ currentTarget }) => {
                              const height = rowHeight(currentTarget);
                              if (!height) return;

                              const selected =
                                  options[
                                      Math.round(
                                          currentTarget.scrollTop / height,
                                      )
                                  ];
                              if (
                                  selected !== undefined &&
                                  selected !== alignedValue.current
                              ) {
                                  alignedValue.current = selected;
                                  onChange(selected);
                              }
                          }
                        : undefined
                }
                className={cn(
                    'relative overflow-y-auto overscroll-contain rounded-none px-0',
                    wheel
                        ? 'h-55 snap-y snap-mandatory [scrollbar-width:none] py-22'
                        : '[scrollbar-width:thin] [scrollbar-gutter:stable] py-0',
                    !wheel &&
                        (options.length === quarters.length + 1
                            ? 'h-40'
                            : 'h-32'),
                )}
            >
                {options.map((option) => {
                    const text = padded ? pad(option) : String(option);

                    return (
                        <ListBox.Item
                            key={option}
                            id={option}
                            textValue={text}
                            className={cn(
                                'mt-0! min-h-0 shrink-0 justify-center rounded-lg px-2 py-0 text-center tabular-nums',
                                wheel
                                    ? 'h-11 snap-center text-xl text-muted hover:bg-transparent data-selected:bg-transparent data-selected:text-[1.625rem] data-selected:font-semibold data-selected:text-accent-soft-foreground'
                                    : 'h-8 text-sm data-selected:bg-accent-soft data-selected:font-semibold data-selected:text-accent-soft-foreground',
                            )}
                        >
                            {text}
                        </ListBox.Item>
                    );
                })}
            </ListBox>
        </div>
    );
}

/** A staged selection keeps the form value intact until the user applies it. */
export function TimePicker({
    title,
    mode,
    value,
    defaultMinutes,
    onChange,
    onOpenChange,
    onEdit,
    preview,
}: Props) {
    const { t } = useTranslation();
    const isDesktop = useIsDesktop();
    const [selection, setSelection] = useState<{
        minutes: number;
        initial: number | null;
    } | null>(null);
    const shown = useOverlayData(selection);
    const isOpen = selection !== null;
    const isClock = mode === 'clock';
    const max = isClock ? fullDayMinutes - 1 : fullDayMinutes;
    const minutes = shown?.minutes ?? 0;
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const exactMinute = (shown?.initial ?? defaultMinutes) % 60;
    const minuteOptions = useMemo(() => {
        if (hour === 24) return [0];
        if (quarters.includes(exactMinute)) return quarters;

        return [...quarters, exactMinute].sort((a, b) => a - b);
    }, [exactMinute, hour]);
    const formatted = isClock
        ? minutesToTime(minutes)
        : formatDuration(minutes * 60);
    const previewText = preview?.(minutes);

    function changeOpen(open: boolean) {
        if (open) {
            const initial =
                value !== null && value >= 0 && value <= max
                    ? Math.floor(value)
                    : null;
            setSelection({ minutes: initial ?? defaultMinutes, initial });
        } else {
            setSelection(null);
        }
        onOpenChange?.(open);
    }

    const columns = (
        <div
            className={cn(
                'relative grid grid-cols-2',
                isDesktop ? 'gap-4' : 'gap-7',
            )}
        >
            {isDesktop && (
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute start-1/2 top-6 bottom-0 border-s border-separator"
                />
            )}
            {!isDesktop && (
                <>
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-22 h-11 rounded-xl bg-accent-soft"
                    />
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-22 z-10 grid h-11 place-items-center text-[1.625rem] font-semibold text-accent-soft-foreground"
                    >
                        :
                    </span>
                </>
            )}
            <TimeColumn
                label={t('Hours')}
                options={isClock ? clockHours : durationHours}
                value={hour}
                onChange={(nextHour) =>
                    setSelection(
                        (current) =>
                            current && {
                                ...current,
                                minutes: Math.min(
                                    nextHour * 60 + (current.minutes % 60),
                                    max,
                                ),
                            },
                    )
                }
                wheel={!isDesktop}
                padded={isClock}
            />
            <TimeColumn
                label={t('Minutes')}
                options={minuteOptions}
                value={minute}
                onChange={(nextMinute) =>
                    setSelection(
                        (current) =>
                            current && {
                                ...current,
                                minutes: Math.min(
                                    Math.floor(current.minutes / 60) * 60 +
                                        nextMinute,
                                    max,
                                ),
                            },
                    )
                }
                wheel={!isDesktop}
                padded
            />
        </div>
    );
    const apply = (
        <Button
            type="button"
            isDisabled={!isClock && minutes === 0}
            className={isDesktop ? 'ms-auto' : 'h-11 flex-1'}
            onPress={() => {
                if (selection && selection.minutes !== selection.initial)
                    onChange(selection.minutes);
                changeOpen(false);
            }}
        >
            {t('Use :time', { time: formatted })}
        </Button>
    );
    const trigger = (
        <Button
            type="button"
            variant="ghost"
            isIconOnly
            aria-label={title}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            onPress={isDesktop ? undefined : () => changeOpen(true)}
            className="h-9 w-8 min-w-0 shrink-0 rounded-field p-0 text-muted data-[time-picker-open]:text-accent sm:h-8 sm:w-9"
            data-time-picker-open={isOpen || undefined}
        >
            <ChevronDown
                aria-hidden="true"
                className={cn('size-4', isOpen && 'rotate-180')}
            />
        </Button>
    );

    if (isDesktop) {
        return (
            <Popover isOpen={isOpen} onOpenChange={changeOpen}>
                {trigger}
                <Popover.Content
                    placement="bottom end"
                    className="w-76 rounded-2xl p-0"
                >
                    <Popover.Dialog className="grid gap-4 p-4">
                        <Popover.Heading className="text-base font-semibold">
                            {title}
                        </Popover.Heading>
                        {columns}
                        <div className="flex items-center gap-2 border-t border-separator pt-3">
                            {previewText && (
                                <span className="text-xs text-muted">
                                    {previewText}
                                </span>
                            )}
                            {apply}
                        </div>
                    </Popover.Dialog>
                </Popover.Content>
            </Popover>
        );
    }

    return (
        <>
            {trigger}
            <ResponsiveDialog
                isOpen={isOpen}
                onOpenChange={changeOpen}
                title={title}
                closeInHeader
                mobileClassName="bg-overlay!"
                footer={
                    <div className="flex w-full items-center gap-3 border-t border-separator pt-3">
                        <Button
                            type="button"
                            variant="ghost"
                            className="h-11 text-accent-soft-foreground"
                            onPress={() => {
                                flushSync(() => changeOpen(false));
                                onEdit();
                            }}
                        >
                            <Keyboard aria-hidden="true" className="size-4" />
                            {t('Type time')}
                        </Button>
                        {apply}
                    </div>
                }
            >
                {columns}
            </ResponsiveDialog>
        </>
    );
}
