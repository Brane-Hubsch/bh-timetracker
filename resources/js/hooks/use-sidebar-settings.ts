import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import {
    completeOrder,
    moveVisibleItem,
    parseOrder,
} from '@/hooks/use-stored-order';
import { useStoredValue } from '@/hooks/use-stored-value';
import { type MainNavItem, mainNavigationOrder } from '@/lib/navigation';
import { update as updateOrder } from '@/routes/sidebar/order';
import { update as updateVisibility } from '@/routes/sidebar/visibility';

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

export function useSyncSidebarSettings() {
    const { auth, sidebarHiddenItems, sidebarOrder } = usePage().props;
    const scope = useSidebarScope();
    const storedHidden = useStoredValue(`timereport:sidebar-hidden:${scope}`);
    const storedOrder = useStoredValue(`timereport:sidebar-order:${scope}`);
    const lastVisibilityImport = useRef<string | null>(null);
    const lastOrderImport = useRef<string | null>(null);
    const verified = Boolean(auth.user.email_verified_at);

    useEffect(
        () =>
            router.on('navigate', ({ detail }) => {
                // Inertia restores older props when navigating browser history.
                if (detail.type === 'history' && navigator.onLine) {
                    router.reload({
                        only: ['sidebarHiddenItems', 'sidebarOrder'],
                    });
                }
            }),
        [],
    );

    useEffect(() => {
        if (
            !verified ||
            sidebarHiddenItems !== null ||
            lastVisibilityImport.current === scope
        ) {
            return;
        }

        const legacyHiddenItems = parseLegacyHiddenItems(storedHidden);
        if (legacyHiddenItems === null) {
            return;
        }

        lastVisibilityImport.current = scope;
        router.patch(
            updateVisibility(),
            { legacy_hidden_items: legacyHiddenItems },
            {
                async: true,
                only: ['sidebarHiddenItems'],
                preserveScroll: true,
                onSuccess: () => router.flushAll(),
            },
        );
    }, [sidebarHiddenItems, scope, storedHidden, verified]);

    useEffect(() => {
        if (
            !verified ||
            sidebarOrder !== null ||
            lastOrderImport.current === scope
        ) {
            return;
        }

        const legacyOrder = parseOrder(storedOrder, mainNavigationOrder);
        if (legacyOrder === null) {
            return;
        }

        lastOrderImport.current = scope;
        router.patch(
            updateOrder(),
            { order: [...legacyOrder], import: true },
            {
                async: true,
                only: ['sidebarOrder'],
                preserveScroll: true,
                onSuccess: () => router.flushAll(),
            },
        );
    }, [sidebarOrder, scope, storedOrder, verified]);
}

export function useSidebarSettings() {
    const { sidebarHiddenItems } = usePage().props;
    const scope = useSidebarScope();
    const stored = useStoredValue(`timereport:sidebar-hidden:${scope}`);
    const legacyHiddenItems = parseLegacyHiddenItems(stored) ?? [];
    const hidden = sidebarHiddenItems ?? legacyHiddenItems;

    function setVisible(title: string, visible: boolean) {
        router.patch(
            updateVisibility(),
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
        isVisible: (title: string) => !hidden.includes(title),
        setVisible,
    };
}

export function useSidebarOrder(items: MainNavItem[]) {
    const { sidebarOrder } = usePage().props;
    const scope = useSidebarScope();
    const stored = useStoredValue(`timereport:sidebar-order:${scope}`);
    const savedOrder =
        sidebarOrder === null
            ? (parseOrder(stored, mainNavigationOrder) ?? mainNavigationOrder)
            : completeOrder(sidebarOrder, mainNavigationOrder);
    const byTitle = new Map(items.map((item) => [item.title, item]));
    const isVisible = (title: string) => byTitle.has(title);
    const order = savedOrder.filter(isVisible);

    function move(item: string, target: string) {
        const next = moveVisibleItem(savedOrder, isVisible, item, target);
        if (!next) {
            return;
        }

        router.patch(
            updateOrder(),
            { order: next.order },
            {
                only: ['sidebarOrder'],
                preserveScroll: true,
                optimistic: () => ({ sidebarOrder: next.order }),
                onSuccess: () => router.flushAll(),
            },
        );

        return next.position;
    }

    return { order, byTitle, move };
}
