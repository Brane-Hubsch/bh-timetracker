import { useSyncExternalStore } from 'react';

/**
 * Snow in December and fireworks from New Year's Eve to 7 January, by the browser's local date.
 * People can turn them off; the choice is kept in this browser only (localStorage).
 */
export type SeasonalEffects = { snow: boolean; fireworks: boolean };

export function seasonalEffectsOn(date: Date): SeasonalEffects {
    const month = date.getMonth();
    const day = date.getDate();

    return {
        snow: month === 11,
        fireworks: (month === 11 && day === 31) || (month === 0 && day <= 7),
    };
}

const STORAGE_KEY = 'seasonal-effects';
const listeners = new Set<() => void>();
let enabledOverride: boolean | null = null;

function readEnabled(): boolean {
    try {
        return window.localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
        return true;
    }
}

export function setSeasonalEffectsEnabled(enabled: boolean): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
        // Storage can be blocked (private mode); the choice then lasts until reload.
    }
    enabledOverride = enabled;
    listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
            enabledOverride = null;
            listener();
        }
    };
    window.addEventListener('storage', onStorage);

    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);
    };
};

export function useSeasonalEffectsEnabled(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => enabledOverride ?? readEnabled(),
        () => true,
    );
}
