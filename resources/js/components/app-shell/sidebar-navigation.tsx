import { Link } from '@inertiajs/react';
import { GripVertical } from 'lucide-react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useStoredOrder } from '@/hooks/use-stored-order';
import { useTranslation } from '@/lib/i18n';
import type { MainNavItem } from '@/lib/navigation';
import { mainNavigationOrder } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const hoverDelay = 300;
const reorderDuration = 180;

type Drag = {
    title: string;
    order: string[];
    from: number;
    to: number;
    step: number;
    offset: number;
    pointer?: { id: number; startY: number };
};

function pointerPosition(drag: Drag, distance: number, count: number) {
    const offset = Math.max(
        -drag.from * drag.step,
        Math.min((count - 1 - drag.from) * drag.step, distance),
    );

    return { offset, to: drag.from + Math.round(offset / drag.step) };
}

function rowOffset(index: number, drag: Drag | null) {
    if (!drag) {
        return 0;
    }
    if (index === drag.from) {
        return drag.offset;
    }
    if (index > drag.from && index <= drag.to) {
        return -drag.step;
    }
    if (index < drag.from && index >= drag.to) {
        return drag.step;
    }

    return 0;
}

export function SidebarNavigation({
    items,
    storageKey,
}: {
    items: MainNavItem[];
    storageKey: string;
}) {
    const { t } = useTranslation();
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const byTitle = new Map(items.map((item) => [item.title, item]));
    const { items: savedOrder, move } = useStoredOrder({
        storageKey,
        defaultOrder: mainNavigationOrder,
        isVisible: (title) => byTitle.has(title),
    });
    const list = useRef<HTMLUListElement>(null);
    const grip = useRef<HTMLButtonElement | null>(null);
    const hoverTimeout = useRef<number | undefined>(undefined);
    const settle = useRef<Map<Element, number> | null>(null);
    const [hovered, setHovered] = useState<string>();
    const [drag, setDrag] = useState<Drag | null>(null);
    const order = drag?.order ?? savedOrder;
    const [announcement, setAnnouncement] = useState('');
    const instructions = useId();

    useEffect(() => () => window.clearTimeout(hoverTimeout.current), []);

    useLayoutEffect(() => {
        const previous = settle.current;
        if (drag || !previous || !list.current) {
            return;
        }
        settle.current = null;

        // Continue from the visible positions, including any interrupted transitions.
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const top = list.current.getBoundingClientRect().top;
            const easing = getComputedStyle(list.current)
                .getPropertyValue('--ease-out-soft')
                .trim();
            for (const row of list.current.children) {
                const before = previous.get(row);
                const after = row.getBoundingClientRect().top - top;
                if (before !== undefined && Math.abs(before - after) > 0.5) {
                    row.animate(
                        [
                            { transform: `translateY(${before - after}px)` },
                            { transform: 'none' },
                        ],
                        { duration: reorderDuration, easing },
                    );
                }
            }
        }

        grip.current?.focus({ preventScroll: true });
        grip.current = null;
    });

    function clearHover() {
        window.clearTimeout(hoverTimeout.current);
        setHovered(undefined);
    }

    function beginDrag(index: number, pointer?: Drag['pointer']) {
        const rows = list.current?.querySelectorAll('li');
        const first = rows?.[0];
        const second = rows?.[1];
        if (drag || !first || !second) {
            return false;
        }

        setDrag({
            title: order[index],
            order,
            from: index,
            to: index,
            step: second.offsetTop - first.offsetTop,
            offset: 0,
            pointer,
        });
        return true;
    }

    function announce(title: string, position: number) {
        setAnnouncement(
            t(':item moved to position :position of :count', {
                item: t(title),
                position,
                count: order.length,
            }),
        );
    }

    function finishDrag(to?: number, restoreFocus = true) {
        if (!drag || !list.current) {
            return;
        }

        const top = list.current.getBoundingClientRect().top;
        settle.current = new Map(
            Array.from(list.current.children, (row) => [
                row,
                row.getBoundingClientRect().top - top,
            ]),
        );
        const target = to === undefined ? undefined : order[to];
        const position =
            target === undefined ? undefined : move(drag.title, target);
        if (position !== undefined) {
            announce(drag.title, position);
        } else if (to === undefined && !drag.pointer) {
            setAnnouncement(t('Reordering canceled'));
        }
        if (!restoreFocus) {
            grip.current = null;
        }
        setDrag(null);
    }

    function onPointerMove(event: PointerEvent) {
        if (drag?.pointer?.id !== event.pointerId) {
            return;
        }
        const next = pointerPosition(
            drag,
            event.clientY - drag.pointer.startY,
            order.length,
        );
        setDrag({ ...drag, ...next });
    }

    function onPointerUp(event: PointerEvent) {
        if (drag?.pointer?.id === event.pointerId) {
            finishDrag(
                pointerPosition(
                    drag,
                    event.clientY - drag.pointer.startY,
                    order.length,
                ).to,
            );
        }
    }

    function onGripKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (!drag) {
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            if (
                drag.pointer &&
                event.currentTarget.hasPointerCapture(drag.pointer.id)
            ) {
                event.currentTarget.releasePointerCapture(drag.pointer.id);
            }
            finishDrag();
            return;
        }
        if (drag.pointer || !['ArrowUp', 'ArrowDown'].includes(event.key)) {
            return;
        }
        event.preventDefault();
        const to = Math.max(
            0,
            Math.min(
                order.length - 1,
                drag.to + (event.key === 'ArrowUp' ? -1 : 1),
            ),
        );
        if (to !== drag.to) {
            setDrag({ ...drag, to, offset: (to - drag.from) * drag.step });
            announce(drag.title, to + 1);
        }
    }

    return (
        <nav aria-label={t('Main')}>
            <ul
                ref={list}
                className="relative grid gap-1"
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onLostPointerCapture={(event) => {
                    if (drag?.pointer?.id === event.pointerId) {
                        finishDrag();
                    }
                }}
            >
                {order.map((title, index) => {
                    const item = byTitle.get(title)!;
                    const isActive =
                        item.isActive ?? isCurrentOrParentUrl(item.href);
                    const lifted = drag?.title === title;
                    const pointerDrag = lifted && Boolean(drag?.pointer);
                    const offset = rowOffset(index, drag);

                    return (
                        <li
                            key={title}
                            style={{
                                transform: offset
                                    ? `translateY(${offset}px)`
                                    : undefined,
                            }}
                            className={cn(
                                'relative rounded-xl',
                                drag &&
                                    !pointerDrag &&
                                    'motion-safe:transition-transform motion-safe:duration-180 motion-safe:ease-out-soft',
                                lifted && 'z-10 shadow-md',
                            )}
                            data-lifted={lifted || undefined}
                            onPointerEnter={(event) => {
                                if (event.pointerType !== 'touch') {
                                    clearHover();
                                    hoverTimeout.current = window.setTimeout(
                                        () => setHovered(title),
                                        hoverDelay,
                                    );
                                }
                            }}
                            onPointerLeave={clearHover}
                        >
                            <Link
                                href={item.href}
                                prefetch
                                aria-current={isActive ? 'page' : undefined}
                                className={cn(
                                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-default',
                                    order.length > 1 && 'pe-10',
                                    (isActive || lifted) && 'bg-default',
                                    isActive ? 'text-foreground' : 'text-muted',
                                    lifted && 'select-none',
                                )}
                            >
                                <item.icon className="size-4 shrink-0" />
                                {t(title)}
                            </Link>
                            {order.length > 1 && (
                                <button
                                    type="button"
                                    aria-label={t('Reorder :item', {
                                        item: t(title),
                                    })}
                                    aria-describedby={instructions}
                                    aria-pressed={lifted}
                                    data-visible={
                                        lifted ||
                                        (!drag && hovered === title) ||
                                        undefined
                                    }
                                    className="pointer-events-none absolute end-2 top-1/2 flex size-6 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-md text-muted opacity-0 transition-opacity duration-150 hover:bg-default hover:text-foreground focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none aria-pressed:cursor-grabbing data-visible:pointer-events-auto data-visible:opacity-100 motion-reduce:transition-none [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"
                                    onPointerDown={(event) => {
                                        if (
                                            event.button !== 0 ||
                                            !event.isPrimary ||
                                            !beginDrag(index, {
                                                id: event.pointerId,
                                                startY: event.clientY,
                                            })
                                        ) {
                                            return;
                                        }
                                        event.preventDefault();
                                        grip.current = event.currentTarget;
                                        event.currentTarget.focus({
                                            preventScroll: true,
                                        });
                                        event.currentTarget.setPointerCapture(
                                            event.pointerId,
                                        );
                                    }}
                                    onClick={(event) => {
                                        if (event.detail !== 0) {
                                            return;
                                        }
                                        if (lifted && drag && !drag.pointer) {
                                            finishDrag(drag.to);
                                        } else if (beginDrag(index)) {
                                            grip.current = event.currentTarget;
                                            setAnnouncement(
                                                t(
                                                    'Use the arrow keys to move, Enter or Space to drop, and Escape to cancel.',
                                                ),
                                            );
                                        }
                                    }}
                                    onKeyDown={onGripKeyDown}
                                    onBlur={() => {
                                        if (lifted && !drag?.pointer) {
                                            finishDrag(undefined, false);
                                        }
                                    }}
                                >
                                    <GripVertical
                                        aria-hidden="true"
                                        className="pointer-events-none size-3.5"
                                    />
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>
            <span id={instructions} className="sr-only">
                {t('Press Enter or Space to start reordering.')}
            </span>
            <span role="status" className="sr-only">
                {announcement}
            </span>
        </nav>
    );
}
