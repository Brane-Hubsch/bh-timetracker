import { Description, InputGroup, Label, TextField } from '@heroui/react';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { TimePicker } from '@/components/form/time-picker';
import { formatDuration, parseDuration } from '@/lib/time';

type Props = {
    label: string;
    visibleLabel: ReactNode;
    pickerTitle: string;
    value: string;
    onChange: (value: string) => void;
    onPickerOpenChange?: (open: boolean) => void;
    preview?: (minutes: number) => string | undefined;
    placeholder: string;
    suffix?: string;
    error?: string;
    name?: string;
    className?: string;
    'data-test'?: string;
};

export function DurationInputField({
    label,
    visibleLabel,
    pickerTitle,
    value,
    onChange,
    onPickerOpenChange,
    preview,
    placeholder,
    suffix,
    error,
    name,
    className,
    'data-test': dataTest,
}: Props) {
    const input = useRef<HTMLInputElement>(null);
    const seconds = parseDuration(value);

    return (
        <TextField
            name={name}
            value={value}
            onChange={onChange}
            isInvalid={Boolean(error)}
            validationBehavior="aria"
            className={className}
        >
            <Label className="sr-only">{label}</Label>
            {visibleLabel}
            <InputGroup
                fullWidth
                className="h-[2.625rem] has-[[data-time-picker-open]]:border-accent sm:h-[2.375rem]"
            >
                <InputGroup.Input
                    ref={input}
                    className="min-w-0 pe-0 max-sm:ps-2 max-sm:text-sm"
                    placeholder={placeholder}
                    data-test={dataTest}
                />
                <InputGroup.Suffix className="gap-0 border-0 p-0">
                    {suffix && (
                        <span
                            aria-hidden="true"
                            className="text-xs whitespace-nowrap text-muted sm:text-sm"
                        >
                            {suffix}
                        </span>
                    )}
                    <TimePicker
                        title={pickerTitle}
                        mode="duration"
                        value={seconds === null ? null : seconds / 60}
                        defaultMinutes={(parseDuration(placeholder) ?? 0) / 60}
                        onChange={(minutes) =>
                            onChange(formatDuration(minutes * 60))
                        }
                        onOpenChange={onPickerOpenChange}
                        onEdit={() => input.current?.focus()}
                        preview={preview}
                    />
                </InputGroup.Suffix>
            </InputGroup>
            {error && (
                <Description className="text-danger">{error}</Description>
            )}
        </TextField>
    );
}
