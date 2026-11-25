import { useSyncExternalStore } from 'react';

const changed = 'timereport:stored-value-changed';
const temporaryValues = new Map<string, string>();

function subscribe(listener: () => void) {
    window.addEventListener('storage', listener);
    window.addEventListener(changed, listener);

    return () => {
        window.removeEventListener('storage', listener);
        window.removeEventListener(changed, listener);
    };
}

export function readStoredValue(key: string) {
    try {
        return temporaryValues.get(key) ?? localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function writeStoredValue(key: string, value: string) {
    try {
        localStorage.setItem(key, value);
        temporaryValues.delete(key);
    } catch {
        temporaryValues.set(key, value);
    }

    window.dispatchEvent(new Event(changed));
}

export function useStoredValue(key: string) {
    return useSyncExternalStore(
        subscribe,
        () => readStoredValue(key),
        () => null,
    );
}
