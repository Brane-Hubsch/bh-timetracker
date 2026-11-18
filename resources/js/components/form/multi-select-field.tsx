import { Label, ListBox, Select } from '@heroui/react';
import type { Key } from '@heroui/react';
import type { SelectOption } from '@/components/form/select-field';

type Props = {
    label: string;
    options: SelectOption[];
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    className?: string;
    'data-test'?: string;
};

/**
 * HeroUI select with multiple selection, controlled by a list of option values.
 */
export function MultiSelectField({
    label,
    options,
    value,
    onChange,
    placeholder,
    className,
    'data-test': dataTest,
}: Props) {
    return (
        <Select
            selectionMode="multiple"
            placeholder={placeholder}
            value={value}
            onChange={(keys) =>
                onChange(((keys as Key[] | null) ?? []).map(String))
            }
            className={className ?? 'w-full'}
            data-test={dataTest}
        >
            <Label>{label}</Label>
            <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox selectionMode="multiple">
                    {options.map((option) => (
                        <ListBox.Item
                            key={option.value}
                            id={option.value}
                            textValue={option.label}
                        >
                            <Label>{option.label}</Label>
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}
