import { useStoredValue, writeStoredValue } from '@/hooks/use-stored-value';

function parseOrder<Item extends string>(
    savedOrder: string | null,
    defaultOrder: readonly Item[],
): readonly Item[] {
    try {
        const saved: unknown = savedOrder && JSON.parse(savedOrder);
        if (Array.isArray(saved)) {
            const savedIds = new Set<unknown>(saved);
            const knownItems = new Map(
                defaultOrder.map((item) => [item as string, item]),
            );
            const order = Array.from(savedIds).flatMap((id) => {
                const item =
                    typeof id === 'string' ? knownItems.get(id) : undefined;
                return item === undefined ? [] : [item];
            });

            return [
                ...order,
                ...defaultOrder.filter((item) => !savedIds.has(item)),
            ];
        }
    } catch {
        // An invalid preference falls back to the default order.
    }

    return defaultOrder;
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
    const order = parseOrder(savedOrder, defaultOrder);
    const items = order.filter(isVisible);

    function move(item: Item, target: Item) {
        const from = items.indexOf(item);
        const to = items.indexOf(target);
        if (from < 0 || to < 0 || from === to) {
            return;
        }

        const reordered = [...items];
        reordered.splice(from, 1);
        reordered.splice(to, 0, item);
        let visibleIndex = 0;
        const nextOrder = order.map((id) =>
            isVisible(id) ? reordered[visibleIndex++] : id,
        );

        writeStoredValue(storageKey, JSON.stringify(nextOrder));

        return to + 1;
    }

    return { items, move };
}
