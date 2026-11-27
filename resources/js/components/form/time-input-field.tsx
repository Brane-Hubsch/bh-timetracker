import { FieldError, Label, TimeField } from '@heroui/react';
import { Time } from '@internationalized/date';
import { useRef } from 'react';
import { TimePicker } from '@/components/form/time-picker';
import { minutesToTime } from '@/lib/time';
import { cn } from '@/lib/utils';

type Props = {
    label: string;
    pickerTitle: string;
    /** Local time as `HH:mm`, or an empty string. */
    value: string;
    defaultTime?: string;
    onChange: (value: string) => void;
    onPickerOpenChange?: (open: boolean) => void;
    /** Server-side validation message, shown below the field. */
    error?: string;
    /** Mark the field invalid without a message (e.g. when one message covers several fields). */
    isInvalid?: boolean;
    isRequired?: boolean;
    autoFocus?: boolean;
    className?: string;
    isEmbedded?: boolean;
    'data-test'?: string;
};

function toTimeValue(value: string): Time | null {
    const match = /^(\d{1,2}):(\d{2})/.exec(value);

    return match ? new Time(Number(match[1]), Number(match[2])) : null;
}

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

/**
 * HeroUI time field (typed hour and minute segments) that works with `HH:mm` strings. The hour
 * cycle follows the app locale, so Swedish shows 24-hour times.
 */
export function TimeInputField({
    label,
    pickerTitle,
    value,
    defaultTime = '',
    onChange,
    onPickerOpenChange,
    error,
    isInvalid,
    isRequired,
    autoFocus,
    className,
    isEmbedded,
    'data-test': dataTest,
}: Props) {
    const input = useRef<HTMLDivElement>(null);
    const time = toTimeValue(value);
    const fallback = toTimeValue(defaultTime);

    return (
        <TimeField
            ref={input}
            value={time}
            onChange={(time) =>
                onChange(time ? `${pad(time.hour)}:${pad(time.minute)}` : '')
            }
            isInvalid={isInvalid ?? Boolean(error)}
            isRequired={isRequired}
            autoFocus={autoFocus}
            aria-label={isEmbedded ? label : undefined}
            shouldForceLeadingZeros
            validationBehavior="aria"
            fullWidth
            className={className}
            data-test={dataTest}
        >
            {!isEmbedded && <Label>{label}</Label>}
            <TimeField.Group
                className={cn(
                    'min-w-0 gap-0 pe-0 has-[[data-time-picker-open]]:rounded-lg has-[[data-time-picker-open]]:ring-1 has-[[data-time-picker-open]]:ring-accent has-[[data-time-picker-open]]:ring-inset',
                    isEmbedded &&
                        'h-full rounded-none border-0 bg-transparent shadow-none outline-none',
                )}
            >
                <TimeField.Input className="min-w-0 flex-1">
                    {(segment) => <TimeField.Segment segment={segment} />}
                </TimeField.Input>
                <TimePicker
                    title={pickerTitle}
                    mode="clock"
                    value={time ? time.hour * 60 + time.minute : null}
                    defaultMinutes={
                        fallback ? fallback.hour * 60 + fallback.minute : 0
                    }
                    onChange={(minutes) => onChange(minutesToTime(minutes))}
                    onOpenChange={onPickerOpenChange}
                    onEdit={() =>
                        input.current
                            ?.querySelector<HTMLElement>('[role="spinbutton"]')
                            ?.focus()
                    }
                />
            </TimeField.Group>
            <FieldError>{error}</FieldError>
        </TimeField>
    );
}
