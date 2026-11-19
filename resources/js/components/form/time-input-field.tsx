import { FieldError, Label, TimeField } from '@heroui/react';
import { Time } from '@internationalized/date';

type Props = {
    label: string;
    /** Local time as `HH:mm`, or an empty string. */
    value: string;
    onChange: (value: string) => void;
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
    value,
    onChange,
    error,
    isInvalid,
    isRequired,
    autoFocus,
    className,
    isEmbedded,
    'data-test': dataTest,
}: Props) {
    return (
        <TimeField
            value={toTimeValue(value)}
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
                className={
                    isEmbedded
                        ? 'h-full rounded-none border-0 bg-transparent shadow-none outline-none'
                        : undefined
                }
            >
                <TimeField.Input>
                    {(segment) => <TimeField.Segment segment={segment} />}
                </TimeField.Input>
            </TimeField.Group>
            <FieldError>{error}</FieldError>
        </TimeField>
    );
}
