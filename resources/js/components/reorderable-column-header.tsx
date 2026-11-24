import { Button, Dropdown } from '@heroui/react';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const columnOrderChanged = 'timereport:column-order-changed';
const columnDragType = 'application/x-timereport-column';

export const columnOrderHeaderClassName = 'group/column-order';

function subscribeToColumnOrder(listener: () => void) {
    window.addEventListener('storage', listener);
    window.addEventListener(columnOrderChanged, listener);

    return () => {
        window.removeEventListener('storage', listener);
        window.removeEventListener(columnOrderChanged, listener);
    };
}

function readSavedOrder(key: string) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function parseColumnOrder<Column extends string>(
    savedOrder: string | null,
    defaultOrder: readonly Column[],
): readonly Column[] {
    try {
        const saved: unknown = savedOrder && JSON.parse(savedOrder);
        if (Array.isArray(saved)) {
            const savedIds = new Set<unknown>(saved);
            const knownColumns = new Map(
                defaultOrder.map((column) => [column as string, column]),
            );
            const order = Array.from(savedIds).flatMap((id) => {
                const column =
                    typeof id === 'string' ? knownColumns.get(id) : undefined;
                return column === undefined ? [] : [column];
            });

            return [
                ...order,
                ...defaultOrder.filter((column) => !savedIds.has(column)),
            ];
        }
    } catch {
        // An invalid preference falls back to the default order.
    }

    return defaultOrder;
}

type ColumnOrderOptions<Column extends string> = {
    storageKey: string;
    defaultOrder: readonly Column[];
    isVisible?: (column: Column) => boolean;
};

export function useColumnOrder<Column extends string>({
    storageKey,
    defaultOrder,
    isVisible = () => true,
}: ColumnOrderOptions<Column>) {
    const { t } = useTranslation();
    const savedOrder = useSyncExternalStore(
        subscribeToColumnOrder,
        () => readSavedOrder(storageKey),
        () => null,
    );
    const [temporaryOrder, setTemporaryOrder] = useState<{
        storageKey: string;
        columns: Column[];
    }>();
    const [drag, setDrag] = useState<{
        source: Column;
        label: string;
        target?: Column;
    } | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const order =
        temporaryOrder?.storageKey === storageKey
            ? temporaryOrder.columns
            : parseColumnOrder(savedOrder, defaultOrder);
    const columns = order.filter(isVisible);

    function move(column: Column, target: Column, label: string) {
        const currentIndex = columns.indexOf(column);
        const targetIndex = columns.indexOf(target);
        if (
            currentIndex < 0 ||
            targetIndex < 0 ||
            currentIndex === targetIndex
        ) {
            return;
        }

        const reordered = [...columns];
        reordered.splice(currentIndex, 1);
        reordered.splice(targetIndex, 0, column);
        let visibleIndex = 0;
        const nextOrder = order.map((id) =>
            isVisible(id) ? reordered[visibleIndex++] : id,
        );

        try {
            localStorage.setItem(storageKey, JSON.stringify(nextOrder));
            setTemporaryOrder(undefined);
            window.dispatchEvent(new Event(columnOrderChanged));
        } catch {
            setTemporaryOrder({ storageKey, columns: nextOrder });
        }

        setAnnouncement(
            t(':column moved to position :position of :count', {
                column: label,
                position: targetIndex + 1,
                count: columns.length,
            }),
        );
    }

    return { columns, announcement, move, drag, setDrag };
}

type ReorderableColumnHeaderProps<Column extends string> = {
    order: ReturnType<typeof useColumnOrder<Column>>;
    column: Column;
    label: string;
    children?: ReactNode;
    className?: string;
};

export function ReorderableColumnHeader<Column extends string>({
    order,
    column,
    label,
    children,
    className,
}: ReorderableColumnHeaderProps<Column>) {
    const { t } = useTranslation();
    const button = useRef<HTMLButtonElement>(null);
    const pendingMove = useRef<Column | undefined>(undefined);
    const { columns, drag, move, setDrag } = order;
    const index = columns.indexOf(column);
    const left = columns[index - 1];
    const right = columns[index + 1];

    return (
        <div
            data-drop-target={drag?.target === column || undefined}
            className={cn(
                'flex min-h-7 items-center gap-1 rounded-md text-sm font-medium whitespace-nowrap data-[drop-target]:bg-accent/15 data-[drop-target]:ring-1 data-[drop-target]:ring-accent data-[drop-target]:ring-inset',
                className,
            )}
            onDragOver={(event) => {
                if (!drag || drag.source === column) {
                    return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                if (drag.target !== column) {
                    setDrag({ ...drag, target: column });
                }
            }}
            onDragLeave={(event) => {
                if (
                    drag?.target === column &&
                    !(
                        event.relatedTarget instanceof Node &&
                        event.currentTarget.contains(event.relatedTarget)
                    )
                ) {
                    setDrag({ ...drag, target: undefined });
                }
            }}
            onDrop={(event) => {
                if (
                    drag &&
                    event.dataTransfer.getData(columnDragType) === drag.source
                ) {
                    event.preventDefault();
                    move(drag.source, column, drag.label);
                    setDrag(null);
                }
            }}
        >
            {columns.length > 1 && (
                <span
                    className="flex shrink-0"
                    draggable
                    onClick={(event) => event.stopPropagation()}
                    onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData(columnDragType, column);
                        setDrag({ source: column, label });
                    }}
                    onDragEnd={() => setDrag(null)}
                >
                    <Dropdown>
                        <Button
                            ref={button}
                            variant="ghost"
                            size="sm"
                            isIconOnly
                            aria-label={t('Move column :column', {
                                column: label,
                            })}
                            className="size-6 min-w-0 cursor-grab rounded-sm p-0 opacity-0 transition-opacity duration-150 group-hover/column-order:opacity-70 focus-visible:opacity-70 active:cursor-grabbing aria-expanded:opacity-70 motion-reduce:transition-none [@media(hover:none)]:opacity-70"
                        >
                            <GripVertical
                                aria-hidden="true"
                                className="pointer-events-none size-3.5"
                            />
                        </Button>
                        <Dropdown.Popover
                            placement="bottom start"
                            ref={(popover) => {
                                const target = pendingMove.current;
                                if (popover || target === undefined) {
                                    return;
                                }
                                pendingMove.current = undefined;
                                // Let the menu restore focus before moving its trigger.
                                requestAnimationFrame(() => {
                                    move(column, target, label);
                                    requestAnimationFrame(() =>
                                        button.current?.focus(),
                                    );
                                });
                            }}
                        >
                            <Dropdown.Menu>
                                <Dropdown.Item
                                    id="left"
                                    isDisabled={left === undefined}
                                    onAction={() => {
                                        pendingMove.current = left;
                                    }}
                                >
                                    {t('Move left')}
                                </Dropdown.Item>
                                <Dropdown.Item
                                    id="right"
                                    isDisabled={right === undefined}
                                    onAction={() => {
                                        pendingMove.current = right;
                                    }}
                                >
                                    {t('Move right')}
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </span>
            )}
            {children ?? label}
        </div>
    );
}

export function ColumnOrderStatus({ announcement }: { announcement: string }) {
    return (
        <span role="status" className="sr-only">
            {announcement}
        </span>
    );
}
