import { Tooltip } from '@heroui/react';
import type { RefObject } from 'react';
import { formatDecimalHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';

type BreakdownItem = {
    key: string | number;
    label: string;
    clientName?: string | null;
    color: string;
    seconds: number;
};

export function BreakdownTooltip({
    title,
    items,
    placement,
    triggerRef,
}: {
    title: string;
    items: BreakdownItem[];
    placement: 'bottom' | 'right';
    triggerRef?: RefObject<Element | null>;
}) {
    const { intlLocale } = useTranslation();

    return (
        <Tooltip.Content
            showArrow
            placement={placement}
            triggerRef={triggerRef}
            className={`w-max px-3 py-2.5 break-normal ${
                placement === 'right'
                    ? 'max-w-[min(20rem,calc(50dvw-1.5rem))] min-w-[min(16rem,calc(50dvw-1.5rem))]'
                    : 'max-w-[calc(100vw-1.5rem)] min-w-[min(16rem,calc(100vw-1.5rem))]'
            }`}
        >
            <Tooltip.Arrow className="pointer-events-none" />
            <p className="text-[13px] leading-[18px] font-semibold wrap-anywhere">
                {title}
            </p>
            {items.length > 0 && (
                <ul className="mt-1.5 grid gap-1 leading-[18px]">
                    {items.map(({ key, label, clientName, color, seconds }) => (
                        <li
                            key={key}
                            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-2"
                        >
                            <span
                                aria-hidden="true"
                                className="size-2 rounded-full"
                                style={{ backgroundColor: color }}
                            />
                            <div className="min-w-0 wrap-anywhere">
                                <span className="block">{label}</span>
                                {clientName && (
                                    <span className="block text-[11px] leading-4 text-muted">
                                        {clientName}
                                    </span>
                                )}
                            </div>
                            <span className="whitespace-nowrap text-muted tabular-nums">
                                {formatDecimalHours(seconds, intlLocale)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </Tooltip.Content>
    );
}
