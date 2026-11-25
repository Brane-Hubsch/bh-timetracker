import { Button, Dropdown } from '@heroui/react';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';
import type { StoredOrderOptions } from '@/hooks/use-stored-order';
import { useStoredOrder } from '@/hooks/use-stored-order';
import { useTranslation } from '@/lib/i18n';

const columnDragType = 'application/x-timereport-column';

export const columnOrderHeaderClassName = 'group/column-order';

export function useColumnOrder<Column extends string>(
    options: StoredOrderOptions<Column>,
) {
    const { t } = useTranslation();
    const { items: columns, move: moveItem } = useStoredOrder(options);
    const [drag, setDrag] = useState<{
        source: Column;
        label: string;
        target?: Column;
    } | null>(null);
    const [announcement, setAnnouncement] = useState('');

    function move(column: Column, target: Column, label: string) {
        const position = moveItem(column, target);
        if (position !== undefined) {
            setAnnouncement(
                t(':column moved to position :position of :count', {
                    column: label,
                    position,
                    count: columns.length,
                }),
            );
        }
    }

    return { columns, announcement, move, drag, setDrag };
}

type ReorderableColumnHeaderProps<Column extends string> = {
    order: ReturnType<typeof useColumnOrder<Column>>;
    column: Column;
    label: string;
    children?: ReactNode;
};

export function ReorderableColumnHeader<Column extends string>({
    order,
    column,
    label,
    children,
}: ReorderableColumnHeaderProps<Column>) {
    const { t } = useTranslation();
    const button = useRef<HTMLButtonElement>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const pendingMove = useRef<(() => void) | undefined>(undefined);
    const { columns, drag, move, setDrag } = order;
    const index = columns.indexOf(column);
    const left = columns[index - 1];
    const right = columns[index + 1];

    const restoreFocusAfterMove = useCallback((popover: HTMLElement | null) => {
        const performMove = pendingMove.current;
        if (popover || !performMove) {
            return;
        }

        pendingMove.current = undefined;
        // Let the menu restore focus before moving its trigger.
        requestAnimationFrame(() => {
            performMove();
            requestAnimationFrame(() =>
                button.current?.focus({ preventScroll: true }),
            );
        });
    }, []);

    function queueMove(target: Column | undefined) {
        if (target !== undefined) {
            pendingMove.current = () => move(column, target, label);
        }
    }

    return (
        <div
            data-drop-target={drag?.target === column || undefined}
            className="flex min-h-7 items-center rounded-md text-sm font-medium whitespace-nowrap data-[drop-target]:bg-accent/15 data-[drop-target]:ring-1 data-[drop-target]:ring-accent data-[drop-target]:ring-inset"
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
                    className="group/column-handle -ms-6 flex shrink-0 cursor-grab active:cursor-grabbing"
                    draggable
                    onClick={(event) => {
                        event.stopPropagation();
                        if (event.target === event.currentTarget) {
                            button.current?.focus({ preventScroll: true });
                            setMenuOpen(true);
                        }
                    }}
                    onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData(columnDragType, column);
                        setDrag({ source: column, label });
                    }}
                    onDragEnd={() => setDrag(null)}
                >
                    <Dropdown isOpen={menuOpen} onOpenChange={setMenuOpen}>
                        <Button
                            ref={button}
                            variant="ghost"
                            size="sm"
                            isIconOnly
                            aria-label={t('Move column :column', {
                                column: label,
                            })}
                            className="size-6 min-w-0 rounded-sm p-0 opacity-0 transition-opacity duration-150 group-hover/column-handle:bg-default group-hover/column-order:opacity-70 focus-visible:opacity-70 aria-expanded:opacity-70 motion-reduce:transition-none [@media(hover:none)]:opacity-70 [@media(pointer:fine)]:pointer-events-none"
                        >
                            <GripVertical
                                aria-hidden="true"
                                className="pointer-events-none size-3.5"
                            />
                        </Button>
                        <Dropdown.Popover
                            placement="bottom start"
                            ref={restoreFocusAfterMove}
                        >
                            <Dropdown.Menu>
                                <Dropdown.Item
                                    id="left"
                                    isDisabled={left === undefined}
                                    onAction={() => queueMove(left)}
                                >
                                    {t('Move left')}
                                </Dropdown.Item>
                                <Dropdown.Item
                                    id="right"
                                    isDisabled={right === undefined}
                                    onAction={() => queueMove(right)}
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
