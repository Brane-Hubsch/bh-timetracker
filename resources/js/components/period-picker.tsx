import { Button, Drawer, Popover } from '@heroui/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { BottomSheetBackdrop } from '@/components/bottom-sheet-backdrop';
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
    /** On phones, show the period as a single outlined button. */
    mobileLabelOnly?: boolean;
    /** Move the step buttons into the mobile panel header. */
    mobileStepInPanel?: boolean;
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
    mobileLabelOnly = false,
    mobileStepInPanel = false,
    className,
    testId,
    children,
}: Props) {
    const { t } = useTranslation();
    const labelOnly = mobileLabelOnly || mobileStepInPanel;
    const isDesktop = useMediaQuery(
        labelOnly
            ? '(min-width: 768px)'
            : compact
              ? '(min-width: 640px)'
              : '(min-width: 800px)',
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
                labelOnly &&
                    'max-md:h-[34px] max-md:border max-md:border-border max-md:bg-surface max-md:text-xs',
                mobileStepInPanel && 'max-md:min-h-0 max-md:px-3',
            )}
            data-test={testId}
        >
            <span
                className={cn(
                    'flex min-w-0 items-baseline gap-2',
                    labelOnly && 'max-md:gap-1.5',
                )}
            >
                {name && (
                    <span
                        className={cn(
                            'truncate font-semibold first-letter:uppercase',
                            labelOnly && 'max-md:text-[13px]',
                            mobileStepInPanel && 'max-md:shrink-0',
                        )}
                    >
                        {name}
                    </span>
                )}
                {range && (
                    <span
                        className={cn(
                            'truncate tabular-nums',
                            name
                                ? 'font-normal text-muted'
                                : mobileStepInPanel
                                  ? 'font-semibold'
                                  : 'font-medium',
                            labelOnly && 'max-md:text-[11px]',
                        )}
                    >
                        {range}
                    </span>
                )}
            </span>
        </Button>
    );

    const stepButton = (direction: -1 | 1, inPanel = false) => (
        <Button
            isIconOnly
            variant="ghost"
            size="sm"
            className={cn(
                stepButtonClassName,
                !inPanel && labelOnly && 'max-md:hidden',
            )}
            isDisabled={!onStep}
            aria-label={
                direction === -1
                    ? (stepLabels?.[0] ?? t('Previous period'))
                    : (stepLabels?.[1] ?? t('Next period'))
            }
            onPress={() => onStep?.(direction)}
            data-test={`${testId}-${direction === -1 ? 'previous' : 'next'}`}
        >
            <span
                aria-hidden="true"
                className={`report-period-icon report-period-icon--${direction === -1 ? 'previous' : 'next'}`}
            />
        </Button>
    );

    const Backdrop = mobileStepInPanel ? BottomSheetBackdrop : Drawer.Backdrop;

    return (
        <div
            className={cn(
                'flex items-center',
                enclosed
                    ? 'h-9 gap-1 rounded-full border border-border bg-surface p-px'
                    : 'gap-1',
                labelOnly &&
                    'max-md:h-auto max-md:border-0 max-md:bg-transparent max-md:p-0',
                className,
            )}
        >
            {(!mobileStepInPanel || isDesktop) && stepButton(-1)}
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
                    <Backdrop variant="opaque">
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
                                        <Drawer.Heading
                                            className={cn(
                                                'font-semibold',
                                                mobileStepInPanel &&
                                                    'text-[17px]/[21px]',
                                            )}
                                        >
                                            {dialogLabel}
                                        </Drawer.Heading>
                                        {mobileStepInPanel ? (
                                            <div className="flex h-9 items-center gap-0.5 rounded-full border border-border bg-surface p-px">
                                                {stepButton(-1, true)}
                                                {stepButton(1, true)}
                                            </div>
                                        ) : (
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
                                        )}
                                    </Drawer.Header>
                                )}
                                <Drawer.Body className="m-0! p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-md:pb-(--mobile-bottom-inset)">
                                    {children({ isDesktop, dismiss })}
                                </Drawer.Body>
                            </Drawer.Dialog>
                        </Drawer.Content>
                    </Backdrop>
                </Drawer>
            )}
            {(!mobileStepInPanel || isDesktop) && stepButton(1)}
        </div>
    );
}
