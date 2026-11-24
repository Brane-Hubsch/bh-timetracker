import { Link, usePage } from '@inertiajs/react';
import { Search } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { SidebarNavigation } from '@/components/app-shell/sidebar-navigation';
import {
    CommandPaletteShortcut,
    useCommandPalette,
} from '@/components/command-palette';
import { OrganizationSwitcher } from '@/components/organization-switcher';
import { UserMenu } from '@/components/user-menu';
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
    const { auth, currentOrganization } = usePage().props;
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

            {currentOrganization && (
                <SidebarNavigation
                    key={JSON.stringify([
                        auth.user.id,
                        currentOrganization.id,
                        items.map(({ title }) => title),
                    ])}
                    storageKey={`timereport:sidebar-order:${auth.user.id}:${currentOrganization.id}`}
                    items={items}
                />
            )}

            <div className="mt-auto">
                <UserMenu showName />
            </div>
        </aside>
    );
}
