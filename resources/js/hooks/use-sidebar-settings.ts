import { usePage } from '@inertiajs/react';
import { useStoredOrder } from '@/hooks/use-stored-order';
import {
    readStoredValue,
    useStoredValue,
    writeStoredValue,
} from '@/hooks/use-stored-value';
import { type MainNavItem, mainNavigationOrder } from '@/lib/navigation';

function hiddenItems(value: string | null): Set<string> {
    try {
        const items: unknown = value && JSON.parse(value);
        if (Array.isArray(items)) {
            return new Set(items.filter((item) => typeof item === 'string'));
        }
    } catch {
        // Invalid preferences leave every item visible.
    }

    return new Set();
}

export function useSidebarSettings() {
    const { auth, currentOrganization } = usePage().props;
    const scope = `${auth.user.id}:${currentOrganization?.id ?? 'none'}`;
    const orderKey = `timereport:sidebar-order:${scope}`;
    const visibilityKey = `timereport:sidebar-hidden:${scope}`;
    const hidden = hiddenItems(useStoredValue(visibilityKey));

    function setVisible(title: string, visible: boolean) {
        const next = hiddenItems(readStoredValue(visibilityKey));
        if (visible) {
            next.delete(title);
        } else {
            next.add(title);
        }
        writeStoredValue(visibilityKey, JSON.stringify([...next]));
    }

    return {
        orderKey,
        isVisible: (title: string) => !hidden.has(title),
        setVisible,
    };
}

export function useSidebarOrder(storageKey: string, items: MainNavItem[]) {
    const byTitle = new Map(items.map((item) => [item.title, item]));
    const { items: order, move } = useStoredOrder({
        storageKey,
        defaultOrder: mainNavigationOrder,
        isVisible: (title) => byTitle.has(title),
    });

    return { order, byTitle, move };
}
