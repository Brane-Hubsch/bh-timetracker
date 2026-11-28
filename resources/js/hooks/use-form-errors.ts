import { useState } from 'react';

export function useFormErrors() {
    const [errors, setErrors] = useState<Record<string, string>>({});

    const clearErrors = (...fields: string[]) => {
        setErrors((current) => {
            const entries = Object.entries(current);
            const remaining = entries.filter(
                ([key]) =>
                    !fields.some(
                        (field) => key === field || key.startsWith(`${field}.`),
                    ),
            );

            return remaining.length === entries.length
                ? current
                : Object.fromEntries(remaining);
        });
    };

    return { errors, setErrors, clearErrors };
}
