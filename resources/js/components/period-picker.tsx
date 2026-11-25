import { Button, Drawer, Popover } from '@heroui/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
    name: string | null;
    range: string | null;
    onStep?: (direction: -1 | 1) => void;
    stepLabels?: [previous: string, next: string];
    label?: string;
    /** Use a single-month panel with its own header. */
    compact?: boolean;
    /** Place the trigger and step buttons inside a shared outline. */
    enclosed?: boolean;
    className?: string;
    testId: string;
    children: (context: {
        isDesktop: boolean;
        dismiss: () => void;
    }) => ReactNode;
};

export function PeriodPicker({
    name,
    range,
    onStep,
    stepLabels,
    label,
    compact = false,
    enclosed = false,
    className,
    testId,
    children,
}: Props) {
    const { t } = useTranslation();
    const isDesktop = useMediaQuery(
        compact ? '(min-width: 640px)' : '(min-width: 800px)',
    );
    const [isOpen, setIsOpen] = useState(false);
    const dismiss = () => setIsOpen(false);
    const dialogLabel = label ?? t('Choose a period');
    const stepButtonClassName = enclosed
        ? 'size-8 shrink-0 rounded-full'
        : undefined;

    const trigger = (
        <Button
            variant={enclosed ? 'ghost' : 'outline'}
            className={cn(
                'min-w-0 flex-1 rounded-full md:flex-none',
                enclosed
                    ? 'h-8 justify-center px-3'
                    : 'h-9 justify-between bg-surface ps-3.5 pe-2.5',
            )}
            data-test={testId}
        >
            <span className="flex min-w-0 items-baseline gap-2">
                {name && (
                    <span className="truncate font-semibold first-letter:uppercase">
                        {name}
                    </span>
                )}
                {range && (
                    <span
                        className={cn(
                            'truncate tabular-nums',
                            name ? 'font-normal text-muted' : 'font-medium',
                        )}
                    >
                        {range}
                    </span>
                )}
            </span>
        </Button>
    );

    return (
        <div
            className={cn(
                'flex items-center',
                enclosed
                    ? 'h-9 gap-1 rounded-full border border-border bg-surface p-px'
                    : 'gap-1',
                className,
            )}
        >
            <Button
                isIconOnly
                variant="ghost"
                size="sm"
                className={stepButtonClassName}
                isDisabled={!onStep}
                aria-label={stepLabels?.[0] ?? t('Previous period')}
                onPress={() => onStep?.(-1)}
                data-test={`${testId}-previous`}
            >
                <span
                    aria-hidden="true"
                    className="report-period-icon report-period-icon--previous"
                />
            </Button>
            {isDesktop ? (
                <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
                    {trigger}
                    <Popover.Content
                        placement={compact ? 'bottom end' : 'bottom start'}
                        offset={8}
                        className={cn(
                            'max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-separator bg-surface p-0',
                            compact ? 'w-[560px]' : 'w-[758px]',
                        )}
                    >
                        <Popover.Dialog
                            aria-label={dialogLabel}
                            className="p-0"
                        >
                            {children({ isDesktop, dismiss })}
                        </Popover.Dialog>
                    </Popover.Content>
                </Popover>
            ) : (
                <Drawer isOpen={isOpen} onOpenChange={setIsOpen}>
                    {trigger}
                    <Drawer.Backdrop variant="opaque">
                        <Drawer.Content
                            placement="bottom"
                            className={compact ? 'max-w-dvw' : undefined}
                        >
                            <Drawer.Dialog className="max-h-[92svh] bg-surface p-0">
                                <Drawer.Handle className="pt-2 pb-0" />
                                {compact ? (
                                    <Drawer.Heading className="sr-only">
                                        {dialogLabel}
                                    </Drawer.Heading>
                                ) : (
                                    <Drawer.Header className="flex-row items-center justify-between border-b border-separator px-5 py-1.5">
                                        <Drawer.Heading className="font-semibold">
                                            {dialogLabel}
                                        </Drawer.Heading>
                                        <Drawer.CloseTrigger
                                            aria-label={t('Close')}
                                            className="static size-10 rounded-full bg-transparent hover:bg-transparent"
                                        >
                                            <span className="grid size-6 place-items-center rounded-full bg-default">
                                                <span
                                                    aria-hidden="true"
                                                    className="report-period-icon report-period-icon--close"
                                                />
                                            </span>
                                        </Drawer.CloseTrigger>
                                    </Drawer.Header>
                                )}
                                <Drawer.Body className="m-0! p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                                    {children({ isDesktop, dismiss })}
                                </Drawer.Body>
                            </Drawer.Dialog>
                        </Drawer.Content>
                    </Drawer.Backdrop>
                </Drawer>
            )}
            <Button
                isIconOnly
                variant="ghost"
                size="sm"
                className={stepButtonClassName}
                isDisabled={!onStep}
                aria-label={stepLabels?.[1] ?? t('Next period')}
                onPress={() => onStep?.(1)}
                data-test={`${testId}-next`}
            >
                <span
                    aria-hidden="true"
                    className="report-period-icon report-period-icon--next"
                />
            </Button>
        </div>
    );
}
