import { Tooltip } from '@heroui/react';
import { formatDecimalHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';

type BreakdownItem = {
    key: string | number;
    label: string;
    color: string;
    seconds: number;
};

export function BreakdownTooltip({
    title,
    items,
    placement,
}: {
    title: string;
    items: BreakdownItem[];
    placement: 'bottom' | 'top';
}) {
    const { intlLocale } = useTranslation();

    return (
        <Tooltip.Content
            showArrow
            placement={placement}
            className="w-58 max-w-[calc(100vw-1rem)] px-3 py-2.5 break-normal"
        >
            <Tooltip.Arrow />
            <p className="text-[13px] leading-[18px] font-semibold wrap-anywhere">
                {title}
            </p>
            <ul className="mt-1.5 grid gap-1 leading-[18px]">
                {items.map(({ key, label, color, seconds }) => (
                    <li
                        key={key}
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-2"
                    >
                        <span
                            aria-hidden="true"
                            className="size-2 rounded-full"
                            style={{ backgroundColor: color }}
                        />
                        <span className="wrap-anywhere">{label}</span>
                        <span className="whitespace-nowrap text-muted tabular-nums">
                            {formatDecimalHours(seconds, intlLocale)}
                        </span>
                    </li>
                ))}
            </ul>
        </Tooltip.Content>
    );
}
