import { usePage } from '@inertiajs/react';
import { useCallback } from 'react';

/**
 * Translations live in Laravel's lang/{locale}.json files, shared by PHP (`__()`) and React (`t()`).
 * Keys are the English source strings, so a missing translation falls back to English.
 */
type Dictionary = Record<string, string>;
export type Replacements = Record<string, string | number>;

const dictionaries: Record<string, Dictionary> = Object.fromEntries(
    Object.entries(
        import.meta.glob<Dictionary>('../../../../lang/*.json', {
            eager: true,
            import: 'default',
        }),
    ).map(([path, dictionary]) => [
        path.replace(/^.*\/([^/]+)\.json$/, '$1'),
        dictionary,
    ]),
);

export const defaultLocale = 'sv';

/** BCP 47 tags used for Intl formatting and react-aria (dates, numbers). */
const intlLocales: Record<string, string> = {
    sv: 'sv-SE',
    en: 'en-GB',
};

export function intlLocale(locale: string): string {
    return intlLocales[locale] ?? locale;
}

/**
 * Replace Laravel-style placeholders: `:name`, `:Name` (capitalised) and `:NAME` (upper case).
 * Longer keys go first, like Laravel, so `:to` does not eat the start of `:total`.
 */
function replace(line: string, replacements: Replacements = {}): string {
    return Object.entries(replacements)
        .sort(([a], [b]) => b.length - a.length)
        .reduce((result, [key, value]) => {
            const text = String(value);

            return result
                .replaceAll(`:${key.toUpperCase()}`, text.toUpperCase())
                .replaceAll(
                    `:${key.charAt(0).toUpperCase()}${key.slice(1)}`,
                    text.charAt(0).toUpperCase() + text.slice(1),
                )
                .replaceAll(`:${key}`, text);
        }, line);
}

export function translate(
    locale: string,
    key: string,
    replacements?: Replacements,
): string {
    return replace(dictionaries[locale]?.[key] ?? key, replacements);
}

/**
 * Pluralise "singular|plural" lines (Laravel's simple two-form syntax). `:count` is replaced.
 */
export function translateChoice(
    locale: string,
    key: string,
    count: number,
    replacements: Replacements = {},
): string {
    const [singular, plural = singular] = (
        dictionaries[locale]?.[key] ?? key
    ).split('|');

    return replace(count === 1 ? singular : plural, {
        count,
        ...replacements,
    });
}

export function useTranslation() {
    const locale = usePage().props.locale ?? defaultLocale;

    const t = useCallback(
        (key: string, replacements?: Replacements) =>
            translate(locale, key, replacements),
        [locale],
    );

    const tc = useCallback(
        (key: string, count: number, replacements?: Replacements) =>
            translateChoice(locale, key, count, replacements),
        [locale],
    );

    return { t, tc, locale, intlLocale: intlLocale(locale) };
}
