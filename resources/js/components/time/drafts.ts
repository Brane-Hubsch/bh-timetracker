import { timeOf } from '@/lib/time';
import type { TimeEntry, TimeEntryDraft } from '@/types';

export function readPlusDurationMinutes(key: string): number {
    try {
        const minutes = Number(localStorage.getItem(key));

        return Number.isInteger(minutes) && minutes > 0 && minutes <= 1440
            ? minutes
            : 0;
    } catch {
        return 0;
    }
}

export function savePlusDurationMinutes(key: string, minutes: number): void {
    if (minutes <= 0 || minutes > 1440) {
        return;
    }

    try {
        localStorage.setItem(key, String(minutes));
    } catch {
        // Reporting still succeeds when browser storage is unavailable.
    }
}

/** Start a new entry where the day's last entry ended (or at 08:00). */
export function newDraft(
    date: string,
    entries: TimeEntry[],
    userId: number,
): TimeEntryDraft {
    const lastEnd = entries
        .filter((entry) => entry.date === date && entry.userId === userId)
        .map((entry) =>
            entry.end.slice(0, 10) === date ? timeOf(entry.end) : '23:59',
        )
        .sort()
        .at(-1);

    return {
        userId,
        projectId: '',
        description: '',
        tags: [],
        date,
        start: lastEnd ?? '08:00',
        end: '',
        isBillable: null,
    };
}
