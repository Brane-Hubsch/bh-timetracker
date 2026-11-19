import { NumberField } from '@heroui/react';
import { useState } from 'react';
import { toMinorUnits } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';

type Props = {
    /** Current rate in minor units (öre), null = default. */
    rate: number | null;
    /** Called with minor units (or null) when the value changed and the field loses focus. */
    onSave: (rate: number | null) => void;
    'aria-label': string;
    className?: string;
};

/**
 * Inline hourly rate editor in major units (kronor). Empty means "use the default rate".
 */
export function RateField({
    rate,
    onSave,
    className,
    'aria-label': ariaLabel,
}: Props) {
    const { t } = useTranslation();
    const [value, setValue] = useState(rate === null ? Number.NaN : rate / 100);

    return (
        <NumberField
            aria-label={ariaLabel}
            value={value}
            onChange={setValue}
            onBlur={() => {
                const next = Number.isNaN(value) ? null : toMinorUnits(value);

                if (next !== rate) {
                    onSave(next);
                }
            }}
            minValue={0}
            formatOptions={{ maximumFractionDigits: 2 }}
            className={className ?? 'w-32'}
        >
            <NumberField.Group>
                <NumberField.Input placeholder={t('Default')} />
            </NumberField.Group>
        </NumberField>
    );
}
