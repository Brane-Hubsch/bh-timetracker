/**
 * Money is stored in the minor currency unit (öre) and durations in seconds.
 */
export function formatMoney(
    minorUnits: number,
    currency: string,
    locale: string,
): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: minorUnits % 100 === 0 ? 0 : 2,
    }).format(minorUnits / 100);
}

/** Hours with at most one decimal, e.g. "12,5 h". */
export function formatHours(seconds: number, locale: string): string {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(seconds / 3600)} h`;
}

/** Convert a major-unit amount from a form (kronor) to minor units (öre). */
export function toMinorUnits(
    value: string | number | null | undefined,
): number | null {
    if (value === '' || value === null || value === undefined) {
        return null;
    }

    const number =
        typeof value === 'number' ? value : Number(value.replace(',', '.'));

    return Number.isFinite(number) ? Math.round(number * 100) : null;
}

/** Decimal hours with up to two decimals, e.g. "12,25 h" – used in reports. */
export function formatDecimalHours(seconds: number, locale: string): string {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(seconds / 3600)} h`;
}
