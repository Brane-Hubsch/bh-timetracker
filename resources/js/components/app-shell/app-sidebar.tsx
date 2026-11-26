import { Link, usePage } from '@inertiajs/react';
import { Search } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { SidebarAccountMenu } from '@/components/app-shell/sidebar-account-menu';
import { SidebarNavigation } from '@/components/app-shell/sidebar-navigation';
import { SidebarTimeActions } from '@/components/app-shell/sidebar-time-actions';
import {
    CommandPaletteShortcut,
    useCommandPalette,
} from '@/components/command-palette';
import { RunningTimerCard } from '@/components/time/running-timer';
import { useSidebarSettings } from '@/hooks/use-sidebar-settings';
import { useTranslation } from '@/lib/i18n';
import { useMainNavigation } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { home } from '@/routes';

export function AppSidebar({ className }: { className?: string }) {
    const { t } = useTranslation();
    const { isVisible } = useSidebarSettings();
    const items = useMainNavigation().filter(({ title }) => isVisible(title));
    const {
        props: { currentOrganization, timer },
        url,
    } = usePage();
    const { open } = useCommandPalette();
    const actionOrganization = isVisible('Add') ? currentOrganization : null;

    return (
        <aside
            id="desktop-sidebar"
            className={cn(
                'flex-col gap-4 overflow-y-auto border-r border-separator bg-background-secondary p-3',
                className,
            )}
        >
            <Link href={home()} className="px-2 py-1">
                <AppLogo />
            </Link>

            {isVisible('Search') && (
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
            )}

            <SidebarNavigation
                key={JSON.stringify([
                    currentOrganization?.id,
                    items.map(({ title }) => title),
                ])}
                items={items}
            />

            <div className="mt-auto grid gap-3">
                {(timer || actionOrganization) && (
                    <>
                        <div className="relative h-9">
                            <RunningTimerCard
                                variant="sidebar"
                                className={cn(
                                    'absolute inset-y-0 end-0 overflow-hidden motion-safe:transition-[width,opacity] motion-safe:duration-240 motion-safe:ease-out-soft',
                                    timer
                                        ? 'w-full'
                                        : 'pointer-events-none w-9 opacity-0',
                                )}
                            />
                            {actionOrganization && (
                                <div
                                    inert={Boolean(timer)}
                                    className={cn(
                                        'absolute end-0 top-0 motion-safe:transition-[scale,opacity] motion-safe:duration-240 motion-safe:ease-out-soft',
                                        timer &&
                                            'pointer-events-none scale-0 opacity-0',
                                    )}
                                >
                                    <SidebarTimeActions
                                        key={JSON.stringify([
                                            actionOrganization.slug,
                                            url,
                                        ])}
                                        organization={actionOrganization}
                                        isDisabled={Boolean(timer)}
                                    />
                                </div>
                            )}
                        </div>
                        <div
                            aria-hidden="true"
                            className="border-t border-separator"
                        />
                    </>
                )}
                <SidebarAccountMenu />
            </div>
        </aside>
    );
}
