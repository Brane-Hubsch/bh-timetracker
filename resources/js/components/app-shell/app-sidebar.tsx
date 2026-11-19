import { Link } from '@inertiajs/react';
import { Search } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import {
    CommandPaletteShortcut,
    useCommandPalette,
} from '@/components/command-palette';
import { OrganizationSwitcher } from '@/components/organization-switcher';
import { UserMenu } from '@/components/user-menu';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useTranslation } from '@/lib/i18n';
import { useMainNavigation } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { home } from '@/routes';

/**
 * Desktop navigation (md and up).
 */
export function AppSidebar({ className }: { className?: string }) {
    const { t } = useTranslation();
    const items = useMainNavigation();
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const { open } = useCommandPalette();

    return (
        <aside
            className={cn(
                'flex-col gap-4 border-r border-separator bg-background-secondary p-3',
                className,
            )}
        >
            <Link href={home()} className="px-2 py-1">
                <AppLogo />
            </Link>

            <OrganizationSwitcher />

            <button
                type="button"
                onClick={open}
                className="flex items-center gap-2 rounded-xl border border-separator bg-background px-3 py-2 text-sm text-muted transition-colors hover:bg-default focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                data-test="command-palette-trigger"
            >
                <Search className="size-4" />
                {t('Search…')}
                <CommandPaletteShortcut className="ms-auto" />
            </button>

            <nav aria-label={t('Main')} className="grid gap-1">
                {items.map((item) => {
                    const isActive = isCurrentOrParentUrl(item.href);

                    return (
                        <Link
                            key={item.title}
                            href={item.href}
                            prefetch
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-default',
                                isActive && 'bg-default text-foreground',
                                !isActive && 'text-muted',
                            )}
                        >
                            <item.icon className="size-4" />
                            {t(item.title)}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto">
                <UserMenu showName />
            </div>
        </aside>
    );
}
