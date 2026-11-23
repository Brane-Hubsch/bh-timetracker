import type { ReactNode } from 'react';

type Props = {
    label: string;
    firstLabel: ReactNode;
    secondLabel: ReactNode;
    firstField: ReactNode;
    secondField: ReactNode;
    isInvalid: boolean;
};

/** Two editable fields inside one outline, with separate labels and a divider. */
export function FieldPair({
    label,
    firstLabel,
    secondLabel,
    firstField,
    secondField,
    isInvalid,
}: Props) {
    return (
        <fieldset aria-label={label} className="min-w-0">
            <legend className="label mb-1 grid w-full grid-cols-2">
                {firstLabel}
                {secondLabel}
            </legend>
            <div
                className="grid h-[2.625rem] grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] items-center rounded-field border-[length:var(--border-width-field)] border-[color:var(--field-border)] bg-field shadow-field focus-within:status-focused-field data-[invalid=true]:status-invalid-field sm:h-[2.375rem]"
                data-invalid={isInvalid}
            >
                {firstField}
                <span
                    aria-hidden="true"
                    className="h-5 bg-[var(--field-border)]"
                />
                {secondField}
            </div>
        </fieldset>
    );
}
