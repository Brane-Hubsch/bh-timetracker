import { useStoredValue, writeStoredValue } from '@/hooks/use-stored-value';

export function completeOrder<Item extends string>(
    savedOrder: readonly unknown[],
    defaultOrder: readonly Item[],
): readonly Item[] {
    const savedIds = new Set(savedOrder);
    const knownItems = new Map<string, Item>(
        defaultOrder.map((item) => [item, item]),
    );

    return [
        ...Array.from(savedIds).flatMap((id) => {
            const item =
                typeof id === 'string' ? knownItems.get(id) : undefined;
            return item === undefined ? [] : [item];
        }),
        ...defaultOrder.filter((item) => !savedIds.has(item)),
    ];
}

export function parseOrder<Item extends string>(
    savedOrder: string | null,
    defaultOrder: readonly Item[],
): readonly Item[] | null {
    try {
        const saved: unknown = savedOrder && JSON.parse(savedOrder);
        if (Array.isArray(saved)) {
            return completeOrder(saved, defaultOrder);
        }
    } catch {
        // An invalid preference falls back to the default order.
    }

    return null;
}

export function moveVisibleItem<Item extends string>(
    order: readonly Item[],
    isVisible: (item: Item) => boolean,
    item: Item,
    target: Item,
) {
    const visible = order.filter(isVisible);
    const from = visible.indexOf(item);
    const to = visible.indexOf(target);
    if (from < 0 || to < 0 || from === to) {
        return;
    }

    visible.splice(from, 1);
    visible.splice(to, 0, item);
    let visibleIndex = 0;

    return {
        order: order.map((id) =>
            isVisible(id) ? visible[visibleIndex++] : id,
        ),
        position: to + 1,
    };
}

export type StoredOrderOptions<Item extends string> = {
    storageKey: string;
    defaultOrder: readonly Item[];
    isVisible?: (item: Item) => boolean;
};

export function useStoredOrder<Item extends string>({
    storageKey,
    defaultOrder,
    isVisible = () => true,
}: StoredOrderOptions<Item>) {
    const savedOrder = useStoredValue(storageKey);
    const order = parseOrder(savedOrder, defaultOrder) ?? defaultOrder;
    const items = order.filter(isVisible);

    function move(item: Item, target: Item) {
        const next = moveVisibleItem(order, isVisible, item, target);
        if (!next) {
            return;
        }

        writeStoredValue(storageKey, JSON.stringify(next.order));
        return next.position;
    }

    return { items, move };
}
