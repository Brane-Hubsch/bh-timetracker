import { Link } from '@inertiajs/react';
import { ReorderableList } from '@/components/reorderable-list';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useSidebarOrder } from '@/hooks/use-sidebar-settings';
import { useTranslation } from '@/lib/i18n';
import type { MainNavItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';

export function SidebarNavigation({ items }: { items: MainNavItem[] }) {
    const { t } = useTranslation();
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const { order, byTitle, move } = useSidebarOrder(items);

    if (order.length === 0) {
        return null;
    }

    return (
        <nav aria-label={t('Main')}>
            <ReorderableList
                items={order}
                move={move}
                className="gap-1"
                rowClassName="rounded-xl"
                renderItem={(title, grip, lifted) => {
                    const item = byTitle.get(title)!;
                    const isActive =
                        item.isActive ?? isCurrentOrParentUrl(item.href);

                    return (
                        <>
                            <Link
                                href={item.href}
                                prefetch
                                aria-current={isActive ? 'page' : undefined}
                                className={cn(
                                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-default',
                                    grip && 'pe-10',
                                    (isActive || lifted) && 'bg-default',
                                    isActive ? 'text-foreground' : 'text-muted',
                                    lifted && 'select-none',
                                )}
                            >
                                <item.icon className="size-4 shrink-0" />
                                {t(title)}
                            </Link>
                            {grip}
                        </>
                    );
                }}
            />
        </nav>
    );
}
