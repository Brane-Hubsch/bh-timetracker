import { Button } from '@heroui/react';
import { Link, router, usePage } from '@inertiajs/react';
import { Play, Plus, Search } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { SidebarAccountMenu } from '@/components/app-shell/sidebar-account-menu';
import { SidebarNavigation } from '@/components/app-shell/sidebar-navigation';
import {
    CommandPaletteShortcut,
    useCommandPalette,
} from '@/components/command-palette';
import { RunningTimerCard, startTimer } from '@/components/time/running-timer';
import { useSidebarSettings } from '@/hooks/use-sidebar-settings';
import { useTranslation } from '@/lib/i18n';
import { useMainNavigation } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { home } from '@/routes';
import { index as timeIndex } from '@/routes/time';

export function AppSidebar({ className }: { className?: string }) {
    const { t } = useTranslation();
    const { orderKey, isVisible } = useSidebarSettings();
    const items = useMainNavigation().filter(({ title }) => isVisible(title));
    const { currentOrganization, timer } = usePage().props;
    const { open } = useCommandPalette();
    const slug = currentOrganization?.slug;
    const startOrganization =
        !timer && currentOrganization?.timerEnabled && isVisible('Start timer')
            ? slug
            : undefined;
    const reportUrl =
        slug && isVisible('Report time')
            ? timeIndex.url(slug, { query: { new: 1 } })
            : undefined;

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
                    orderKey,
                    items.map(({ title }) => title),
                ])}
                storageKey={orderKey}
                items={items}
            />

            <div className="mt-auto grid gap-3">
                {(timer || startOrganization || reportUrl) && (
                    <>
                        <div className="flex items-center justify-end gap-2">
                            {timer && (
                                <RunningTimerCard
                                    variant="sidebar"
                                    className="min-w-0 flex-1"
                                />
                            )}
                            {startOrganization && (
                                <Button
                                    variant="tertiary"
                                    className="min-w-0 flex-1 bg-surface"
                                    onPress={() =>
                                        startTimer(startOrganization)
                                    }
                                    data-test="sidebar-start-timer"
                                >
                                    <Play
                                        aria-hidden="true"
                                        className="size-4 shrink-0"
                                    />
                                    {t('Start timer')}
                                </Button>
                            )}
                            {reportUrl && (
                                <Button
                                    isIconOnly
                                    className="shrink-0"
                                    aria-label={t('Report time')}
                                    onPress={() => router.visit(reportUrl)}
                                    data-test="sidebar-report-time"
                                >
                                    <Plus
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                </Button>
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
