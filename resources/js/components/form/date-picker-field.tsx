import {
    Calendar,
    DateField,
    DatePicker,
    FieldError,
    Label,
} from '@heroui/react';
import { parseDate } from '@internationalized/date';

type Props = {
    label: string;
    /** Local date as `YYYY-MM-DD`, or an empty string. */
    value: string;
    onChange: (value: string) => void;
    /** Display text for the selected date while the picker is idle. */
    relativeLabel?: string;
    /** Server-side validation message, shown below the field. */
    error?: string;
    /** Describe the error rendered outside an embedded field. */
    errorId?: string;
    isRequired?: boolean;
    isEmbedded?: boolean;
    className?: string;
    'data-test'?: string;
};

function toDateValue(value: string) {
    try {
        return value ? parseDate(value) : null;
    } catch {
        return null;
    }
}

/**
 * HeroUI date picker (typed segments plus a calendar popover) that works with `YYYY-MM-DD` strings.
 * Formats and the first day of the week follow the app locale.
 */
export function DatePickerField({
    label,
    value,
    onChange,
    relativeLabel,
    error,
    errorId,
    isRequired,
    isEmbedded,
    className,
    'data-test': dataTest,
}: Props) {
    return (
        <DatePicker
            value={toDateValue(value)}
            onChange={(date) => onChange(date ? date.toString() : '')}
            isInvalid={Boolean(error)}
            isRequired={isRequired}
            aria-label={isEmbedded ? label : undefined}
            aria-describedby={errorId}
            validationBehavior="aria"
            className={`${className ?? 'w-full'} group/date-picker`}
            data-test={dataTest}
        >
            {!isEmbedded && <Label>{label}</Label>}
            <DateField.Group
                fullWidth
                className={
                    isEmbedded
                        ? 'h-full rounded-none border-0 bg-transparent shadow-none outline-none'
                        : 'relative'
                }
            >
                <DateField.Input
                    className={
                        isEmbedded
                            ? 'min-w-0 ps-1.5 pe-0 text-sm sm:ps-3'
                            : relativeLabel
                              ? 'opacity-0 group-focus-within/date-picker:opacity-100 group-data-[open]/date-picker:opacity-100'
                              : undefined
                    }
                >
                    {(segment) => (
                        <DateField.Segment
                            segment={segment}
                            className={isEmbedded ? 'max-sm:px-0' : undefined}
                        />
                    )}
                </DateField.Input>
                {relativeLabel && (
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute start-3 text-base group-focus-within/date-picker:hidden group-data-[open]/date-picker:hidden sm:text-sm"
                    >
                        {relativeLabel}
                    </span>
                )}
                <DateField.Suffix
                    className={isEmbedded ? 'me-0.5 sm:me-2' : undefined}
                >
                    <DatePicker.Trigger>
                        <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                </DateField.Suffix>
            </DateField.Group>
            {!isEmbedded && <FieldError>{error}</FieldError>}
            <DatePicker.Popover>
                <Calendar aria-label={label}>
                    <Calendar.Header>
                        <Calendar.YearPickerTrigger>
                            <Calendar.YearPickerTriggerHeading />
                            <Calendar.YearPickerTriggerIndicator />
                        </Calendar.YearPickerTrigger>
                        <Calendar.NavButton slot="previous" />
                        <Calendar.NavButton slot="next" />
                    </Calendar.Header>
                    <Calendar.Grid>
                        <Calendar.GridHeader>
                            {(day) => (
                                <Calendar.HeaderCell>{day}</Calendar.HeaderCell>
                            )}
                        </Calendar.GridHeader>
                        <Calendar.GridBody>
                            {(date) => <Calendar.Cell date={date} />}
                        </Calendar.GridBody>
                    </Calendar.Grid>
                    <Calendar.YearPickerGrid>
                        <Calendar.YearPickerGridBody>
                            {({ year }) => (
                                <Calendar.YearPickerCell year={year} />
                            )}
                        </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                </Calendar>
            </DatePicker.Popover>
        </DatePicker>
    );
}
