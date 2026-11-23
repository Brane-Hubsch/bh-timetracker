/**
 * Time helpers for time reporting. The backend sends local wall-clock strings in the user's time
 * zone ("2026-11-18T09:30"), so these helpers work on plain strings and never on the browser's
 * own time zone.
 */

/**
 * Parse a human duration into seconds: "1,5", "1.5", "2", "1:30", "90m", "1h30", "1 t 30 min".
 * Mirrors App\Support\DurationParser.
 */
export function parseDuration(input: string): number | null {
    const value = input.replace(/\s+/g, '').toLowerCase();

    if (value === '') {
        return null;
    }

    let match = /^(\d+):([0-5]?\d)$/.exec(value);

    if (match) {
        return Number(match[1]) * 3600 + Number(match[2]) * 60;
    }

    if (/^\d+(?:[.,]\d+)?$/.test(value)) {
        return Math.round(Number(value.replace(',', '.')) * 3600);
    }

    match =
        /^(?:(\d+(?:[.,]\d+)?)(?:h|t|tim|timmar|timme))?(?:(\d+)(?:m|min|minuter)?)?$/.exec(
            value,
        );

    if (match && (match[1] ?? '') + (match[2] ?? '') !== '') {
        const hours = Number((match[1] ?? '0').replace(',', '.'));
        const minutes = Number(match[2] ?? 0);

        return Math.round(hours * 3600 + minutes * 60);
    }

    return null;
}

/** "1:30" (hours:minutes). */
export function formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);

    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "HH:mm" → minutes after midnight. */
export function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);

    return hours * 60 + minutes;
}

/** Minutes after midnight (wraps past 24 h) → "HH:mm". */
export function minutesToTime(minutes: number): string {
    const wrapped = ((minutes % 1440) + 1440) % 1440;

    return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/** Seconds between two "HH:mm" times; an end at or before the start means the next day. */
export function secondsBetween(start: string, end: string): number {
    const difference = timeToMinutes(end) - timeToMinutes(start);

    return (difference <= 0 ? difference + 1440 : difference) * 60;
}

/** Add days to a "YYYY-MM-DD" date. */
export function addDays(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);

    return value.toISOString().slice(0, 10);
}

/** The seven dates of the week starting at weekStart. */
export function weekDates(weekStart: string): string[] {
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/**
 * Working days from `from` to `to` (inclusive): weekdays that aren't one of the organization's
 * holidays ("YYYY-MM-DD"). Mirrors `App\Support\WorkingDays`.
 */
export function workingDays(
    from: string,
    to: string,
    holidays: string[],
): number {
    const skip = new Set(holidays);
    let count = 0;

    for (let day = from, guard = 0; day <= to && guard < 400; guard++) {
        const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();

        if (weekday !== 0 && weekday !== 6 && !skip.has(day)) {
            count++;
        }

        day = addDays(day, 1);
    }

    return count;
}

/** Format a "YYYY-MM-DD" date, e.g. "mån 18 nov". */
export function formatDate(
    date: string,
    locale: string,
    options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    },
): string {
    return new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * Format a range of "YYYY-MM-DD" dates without repeating what they share, e.g. "16–22 nov." or
 * "30 nov.–6 dec.".
 */
export function formatDateRange(
    from: string,
    to: string,
    locale: string,
    options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
): string {
    return new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: 'UTC',
    }).formatRange(new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`));
}

/** ISO-8601 week number of a "YYYY-MM-DD" date. */
export function isoWeek(date: string): number {
    const value = new Date(`${date}T00:00:00Z`);
    const day = value.getUTCDay() || 7;
    value.setUTCDate(value.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));

    return Math.ceil(
        ((value.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
}

/** "2026-11-18T09:30" → "09:30". */
export function timeOf(localDateTime: string): string {
    return localDateTime.slice(11, 16);
}

/** A Date that FullCalendar created in UTC mode → local wall-clock string. */
export function fromCalendarDate(date: Date): string {
    return date.toISOString().slice(0, 16);
}
