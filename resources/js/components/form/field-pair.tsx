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
                className="field-pair grid h-[2.625rem] grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] rounded-field border-[length:var(--border-width-field)] border-[color:var(--field-border)] bg-field shadow-field data-[invalid=true]:outline-1 data-[invalid=true]:outline-danger data-[invalid=true]:outline-solid sm:h-[2.375rem]"
                data-invalid={isInvalid}
            >
                <div className="grid min-w-0">{firstField}</div>
                <span
                    aria-hidden="true"
                    className="h-5 self-center bg-[var(--field-border)]"
                />
                <div className="grid min-w-0">{secondField}</div>
            </div>
        </fieldset>
    );
}
