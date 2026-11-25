import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import { useStoredOrder } from '@/hooks/use-stored-order';
import { useStoredValue } from '@/hooks/use-stored-value';
import { type MainNavItem, mainNavigationOrder } from '@/lib/navigation';
import { update } from '@/routes/sidebar/visibility';

const sidebarItems = ['Search', ...mainNavigationOrder, 'Add'];

function parseLegacyHiddenItems(value: string | null): string[] | null {
    try {
        const items: unknown = value && JSON.parse(value);
        if (Array.isArray(items)) {
            const hidden = new Set<unknown>(items);
            // Keep the shortcut hidden if both of its previous buttons were hidden.
            if (hidden.has('Report time') && hidden.has('Start timer')) {
                hidden.add('Add');
            }

            return sidebarItems.filter((item) => hidden.has(item));
        }
    } catch {
        // Leave malformed browser settings ineligible for import.
    }

    return null;
}

function useSidebarScope() {
    const { auth, currentOrganization } = usePage().props;

    return `${auth.user.id}:${currentOrganization?.id ?? 'none'}`;
}

export function useSyncSidebarVisibility() {
    const { auth, sidebarHiddenItems } = usePage().props;
    const scope = useSidebarScope();
    const stored = useStoredValue(`timereport:sidebar-hidden:${scope}`);
    const lastAttempt = useRef<string | null>(null);
    const verified = Boolean(auth.user.email_verified_at);

    useEffect(
        () =>
            router.on('navigate', ({ detail }) => {
                // Inertia restores older props when navigating browser history.
                if (detail.type === 'history' && navigator.onLine) {
                    router.reload({ only: ['sidebarHiddenItems'] });
                }
            }),
        [],
    );

    useEffect(() => {
        if (
            !verified ||
            sidebarHiddenItems !== null ||
            lastAttempt.current === scope
        ) {
            return;
        }

        const legacyHiddenItems = parseLegacyHiddenItems(stored);
        if (legacyHiddenItems === null) {
            return;
        }

        lastAttempt.current = scope;
        router.patch(
            update(),
            { legacy_hidden_items: legacyHiddenItems },
            {
                async: true,
                only: ['sidebarHiddenItems'],
                preserveScroll: true,
                onSuccess: () => router.flushAll(),
            },
        );
    }, [sidebarHiddenItems, scope, stored, verified]);
}

export function useSidebarSettings() {
    const { sidebarHiddenItems } = usePage().props;
    const scope = useSidebarScope();
    const orderKey = `timereport:sidebar-order:${scope}`;
    const stored = useStoredValue(`timereport:sidebar-hidden:${scope}`);
    const legacyHiddenItems = parseLegacyHiddenItems(stored) ?? [];
    const hidden = sidebarHiddenItems ?? legacyHiddenItems;

    function setVisible(title: string, visible: boolean) {
        router.patch(
            update(),
            { item: title, visible, legacy_hidden_items: legacyHiddenItems },
            {
                only: ['sidebarHiddenItems'],
                preserveScroll: true,
                optimistic: (props) => {
                    const next = new Set(
                        props.sidebarHiddenItems ?? legacyHiddenItems,
                    );
                    if (visible) {
                        next.delete(title);
                    } else {
                        next.add(title);
                    }

                    return { sidebarHiddenItems: [...next] };
                },
                onSuccess: () => router.flushAll(),
            },
        );
    }

    return {
        orderKey,
        isVisible: (title: string) => !hidden.includes(title),
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
