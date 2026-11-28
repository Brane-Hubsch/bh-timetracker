import { useState } from 'react';

export function useFormErrors() {
    const [errors, setErrors] = useState<Record<string, string>>({});

    const clearErrors = (...fields: string[]) => {
        setErrors((current) => {
            const remaining = Object.entries(current).filter(
                ([key]) =>
                    !fields.some(
                        (field) => key === field || key.startsWith(`${field}.`),
                    ),
            );

            return remaining.length === Object.keys(current).length
                ? current
                : Object.fromEntries(remaining);
        });
    };

    return { errors, setErrors, clearErrors };
}
