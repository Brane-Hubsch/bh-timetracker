import { Button, Dropdown, Label, Tooltip } from '@heroui/react';
import { CalendarOff, Clock, Play, Plus } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { TimeReportMode } from '@/types';

type TimeActionHandlers = {
    onStartTimer?: () => void;
    onReport: (mode: TimeReportMode) => void;
};

function timeActions({ onStartTimer, onReport }: TimeActionHandlers) {
    return [
        ...(onStartTimer
            ? [
                  {
                      id: 'start-timer',
                      label: 'Start timer',
                      Icon: Play,
                      run: onStartTimer,
                  },
              ]
            : []),
        {
            id: 'report-time',
            label: 'Report time',
            Icon: Clock,
            run: () => onReport('time'),
        },
        {
            id: 'report-absence',
            label: 'Report absence',
            Icon: CalendarOff,
            run: () => onReport('absence'),
        },
    ];
}

type Props = TimeActionHandlers & {
    placement: 'top end' | 'bottom end';
    className?: string;
    isDisabled?: boolean;
    testId: string;
};

export function TimeActionsMenu({
    onStartTimer,
    onReport,
    placement,
    className,
    isDisabled = false,
    testId,
}: Props) {
    const { t } = useTranslation();
    const label = t('Quick actions');
    const trigger = (
        <Button
            isIconOnly
            isDisabled={isDisabled || undefined}
            aria-label={t('Add')}
            className={cn('group', className)}
            data-test={testId}
        >
            <Plus
                aria-hidden="true"
                className="size-4 group-aria-expanded:rotate-45 motion-safe:transition-transform motion-safe:duration-240 motion-safe:ease-out-soft"
            />
        </Button>
    );

    if (isDisabled) {
        return trigger;
    }

    return (
        <Dropdown>
            {trigger}
            <Dropdown.Popover placement={placement} offset={8} className="w-56">
                <Dropdown.Menu aria-label={label}>
                    {timeActions({ onStartTimer, onReport }).map(
                        ({ id, label, Icon, run }) => (
                            <Dropdown.Item key={id} id={id} onAction={run}>
                                <Icon aria-hidden="true" className="size-4" />
                                <Label>{t(label)}</Label>
                            </Dropdown.Item>
                        ),
                    )}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}

export function CalendarDayActions({
    dateLabel,
    ...handlers
}: TimeActionHandlers & { dateLabel: string }) {
    const { t } = useTranslation();

    return (
        <div
            role="group"
            aria-label={dateLabel}
            className="time-calendar-day-actions"
        >
            {timeActions(handlers).map(({ id, label, Icon, run }) => (
                <Tooltip key={id} delay={350} closeDelay={0}>
                    <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        aria-label={t(label)}
                        className="group size-6 min-w-0 rounded-md p-0 text-muted hover:text-foreground focus-visible:ring-inset"
                        onPress={run}
                    >
                        <Icon
                            aria-hidden="true"
                            className="size-3.5 opacity-35 group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:transition-opacity motion-safe:duration-160 motion-safe:ease-out-soft"
                        />
                    </Button>
                    <Tooltip.Content placement="left">
                        {t(label)}
                    </Tooltip.Content>
                </Tooltip>
            ))}
        </div>
    );
}
