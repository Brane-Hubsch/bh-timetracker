import { Description, FieldError, Label, ListBox, Select } from '@heroui/react';
import type { Key, ReactNode } from 'react';

export type SelectOption = {
    value: string;
    label: string;
};

type SelectFieldProps = {
    name: string;
    label: ReactNode;
    options: SelectOption[];
    error?: string;
    description?: ReactNode;
    placeholder?: string;
    defaultValue?: string;
    value?: string;
    onChange?: (value: string) => void;
    isRequired?: boolean;
    isDisabled?: boolean;
    className?: string;
    'data-test'?: string;
};

/**
 * HeroUI select wired for Inertia forms: submits its value under `name`.
 */
export function SelectField({
    name,
    label,
    options,
    error,
    description,
    placeholder,
    defaultValue,
    value,
    onChange,
    isRequired,
    isDisabled,
    className,
    'data-test': dataTest,
}: SelectFieldProps) {
    return (
        <Select
            name={name}
            placeholder={placeholder}
            defaultValue={defaultValue}
            value={value}
            onChange={(key: Key | null) => onChange?.(String(key ?? ''))}
            isRequired={isRequired}
            isDisabled={isDisabled}
            isInvalid={Boolean(error)}
            validationBehavior="aria"
            className={className ?? 'w-full'}
            data-test={dataTest}
        >
            <Label>{label}</Label>
            <Select.Trigger className="min-w-0">
                <Select.Value className="min-w-0 truncate" />
                <Select.Indicator />
            </Select.Trigger>
            {description && <Description>{description}</Description>}
            <FieldError>{error}</FieldError>
            <Select.Popover>
                <ListBox>
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
