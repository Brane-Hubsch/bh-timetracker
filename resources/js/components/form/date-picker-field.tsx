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
    /** Server-side validation message, shown below the field. */
    error?: string;
    isRequired?: boolean;
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
    error,
    isRequired,
    className,
    'data-test': dataTest,
}: Props) {
    return (
        <DatePicker
            value={toDateValue(value)}
            onChange={(date) => onChange(date ? date.toString() : '')}
            isInvalid={Boolean(error)}
            isRequired={isRequired}
            validationBehavior="aria"
            className={className ?? 'w-full'}
            data-test={dataTest}
        >
            <Label>{label}</Label>
            <DateField.Group fullWidth>
                <DateField.Input>
                    {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateField.Suffix>
                    <DatePicker.Trigger>
                        <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                </DateField.Suffix>
            </DateField.Group>
            <FieldError>{error}</FieldError>
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
