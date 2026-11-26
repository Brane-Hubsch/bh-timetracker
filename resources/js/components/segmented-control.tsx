import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import type { Key } from '@heroui/react';

type Option<T extends string> = { id: T; label: string };

type Props<T extends string> = {
    options: Option<T>[];
    value: T;
    onChange: (value: T) => void;
    'aria-label': string;
    'aria-describedby'?: string;
    className?: string;
    fullWidth?: boolean;
    'data-test'?: string;
};

/**
 * Pick one option from a small set, such as a view, filter, or form setting.
 */
export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    className,
    fullWidth = false,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    'data-test': dataTest,
}: Props<T>) {
    return (
        <ToggleButtonGroup
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
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
            className={`rounded-full bg-default ${fullWidth ? 'grid w-full auto-cols-fr grid-flow-col p-[3px]' : 'gap-1 p-1'} ${className ?? ''}`}
            data-test={dataTest}
        >
            {options.map((option) => (
                <ToggleButton
                    key={option.id}
                    id={option.id}
                    className={`rounded-full bg-transparent transition-colors duration-200 data-[selected=true]:bg-segment data-[selected=true]:shadow-sm ${fullWidth ? 'h-8 w-full min-w-0 justify-center px-0.5 text-[clamp(0.75rem,3.6vw,0.875rem)] font-normal whitespace-nowrap text-muted data-[selected=true]:font-medium data-[selected=true]:text-foreground' : 'px-3 text-foreground data-[selected=true]:text-accent-soft-foreground'}`}
                >
                    {option.label}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}
