import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import type { Key } from '@heroui/react';

type Option<T extends string> = { id: T; label: string };

type Props<T extends string> = {
    options: Option<T>[];
    value: T;
    onChange: (value: T) => void;
    'aria-label': string;
    className?: string;
    'data-test'?: string;
};

/**
 * Pick one of a few views or filters (e.g. list/week/day, active/archived). A toggle button group,
 * not tabs: it switches what the page shows rather than revealing a tab panel.
 */
export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    className,
    'aria-label': ariaLabel,
    'data-test': dataTest,
}: Props<T>) {
    return (
        <ToggleButtonGroup
            aria-label={ariaLabel}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set<Key>([value])}
            onSelectionChange={(keys) => {
                const [key] = [...keys];

                if (key !== undefined) {
                    onChange(String(key) as T);
                }
            }}
            isDetached
            size="sm"
            className={`gap-1 rounded-full bg-default p-1 ${className ?? ''}`}
            data-test={dataTest}
        >
            {options.map((option) => (
                <ToggleButton
                    key={option.id}
                    id={option.id}
                    className="rounded-full bg-transparent px-3 text-muted transition-colors duration-200 data-[selected=true]:bg-segment data-[selected=true]:text-segment-foreground data-[selected=true]:shadow-sm"
                >
                    {option.label}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}
