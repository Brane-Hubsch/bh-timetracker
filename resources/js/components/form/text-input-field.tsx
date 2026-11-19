import {
    Description,
    FieldError,
    Input,
    InputGroup,
    Label,
    TextField,
} from '@heroui/react';
import type { ComponentProps, ReactNode } from 'react';

type TextInputFieldProps = {
    name: string;
    label: ReactNode;
    /** Server-side validation message (e.g. from Inertia's `errors`). */
    error?: string;
    description?: ReactNode;
    type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';
    defaultValue?: string;
    value?: string;
    onChange?: (value: string) => void;
    isRequired?: boolean;
    isDisabled?: boolean;
    isReadOnly?: boolean;
    className?: string;
    suffix?: ReactNode;
} & Omit<
    ComponentProps<typeof Input>,
    'name' | 'type' | 'defaultValue' | 'value' | 'onChange' | 'className'
>;

/**
 * HeroUI text field wired for Inertia forms: uncontrolled by default (submitted by name), with the
 * server-side validation error shown below the input.
 */
export function TextInputField({
    name,
    label,
    error,
    description,
    type = 'text',
    defaultValue,
    value,
    onChange,
    isRequired,
    isDisabled,
    isReadOnly,
    className,
    suffix,
    ...inputProps
}: TextInputFieldProps) {
    return (
        <TextField
            name={name}
            type={type}
            defaultValue={defaultValue}
            value={value}
            onChange={onChange}
            isRequired={isRequired}
            isDisabled={isDisabled}
            isReadOnly={isReadOnly}
            isInvalid={Boolean(error)}
            validationBehavior="aria"
            className={className ?? 'w-full'}
        >
            <Label>{label}</Label>
            {suffix ? (
                <InputGroup>
                    <InputGroup.Input {...inputProps} className="min-w-0" />
                    <InputGroup.Suffix className="border-0 px-1">
                        {suffix}
                    </InputGroup.Suffix>
                </InputGroup>
            ) : (
                <Input {...inputProps} />
            )}
            {description && <Description>{description}</Description>}
            <FieldError>{error}</FieldError>
        </TextField>
    );
}
