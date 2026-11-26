import { Description, FieldError, Label, ListBox, Select } from '@heroui/react';
import type { Key, ReactNode } from 'react';

export type SelectOption = {
    value: string;
    label: string;
};

type SelectFieldProps<Option extends SelectOption> = {
    name: string;
    label: ReactNode;
    options: Option[];
    renderOption?: (option: Option) => ReactNode;
    error?: string;
    description?: ReactNode;
    placeholder?: string;
    defaultValue?: string;
    value?: string;
    onChange?: (value: string) => void;
    isRequired?: boolean;
    isDisabled?: boolean;
    className?: string;
    /** Extra classes for the trigger, e.g. a pill-shaped toolbar picker. */
    triggerClassName?: string;
    triggerAriaLabel?: string;
    hideIndicator?: boolean;
    'data-test'?: string;
};

/**
 * HeroUI select wired for Inertia forms: submits its value under `name`.
 */
export function SelectField<Option extends SelectOption>({
    name,
    label,
    options,
    renderOption,
    error,
    description,
    placeholder,
    defaultValue,
    value,
    onChange,
    isRequired,
    isDisabled,
    className,
    triggerClassName,
    triggerAriaLabel,
    hideIndicator,
    'data-test': dataTest,
}: SelectFieldProps<Option>) {
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
            <Select.Trigger
                aria-label={triggerAriaLabel}
                className={`min-w-0 ${triggerClassName ?? ''}`}
            >
                <Select.Value className="min-w-0 truncate" />
                {!hideIndicator && <Select.Indicator />}
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
                            {renderOption ? (
                                renderOption(option)
                            ) : (
                                <Label>{option.label}</Label>
                            )}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}
