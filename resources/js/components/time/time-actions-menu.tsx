import { Button, Dropdown, Label } from '@heroui/react';
import { CalendarOff, Clock, Play, Plus } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { TimeReportMode } from '@/types';

type Props = {
    onStartTimer?: () => void;
    onReport: (mode: TimeReportMode) => void;
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
                    {onStartTimer && (
                        <Dropdown.Item id="start-timer" onAction={onStartTimer}>
                            <Play aria-hidden="true" className="size-4" />
                            <Label>{t('Start timer')}</Label>
                        </Dropdown.Item>
                    )}
                    <Dropdown.Item
                        id="report-time"
                        onAction={() => onReport('time')}
                    >
                        <Clock aria-hidden="true" className="size-4" />
                        <Label>{t('Report time')}</Label>
                    </Dropdown.Item>
                    <Dropdown.Item
                        id="report-absence"
                        onAction={() => onReport('absence')}
                    >
                        <CalendarOff aria-hidden="true" className="size-4" />
                        <Label>{t('Report absence')}</Label>
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}
