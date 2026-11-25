import { Breadcrumbs } from '@heroui/react';
import { AppSidebar } from '@/components/app-shell/app-sidebar';
import { CommandPaletteProvider } from '@/components/command-palette';
import {
    MobileBottomNav,
    MobileTopBar,
} from '@/components/app-shell/mobile-navigation';
import { usePage } from '@inertiajs/react';
import {
    RunningTimerCard,
    useTimerTitle,
} from '@/components/time/running-timer';
import { useRefreshOnReturn } from '@/hooks/use-refresh-on-return';
import { useTranslation } from '@/lib/i18n';
import { toUrl } from '@/lib/utils';
import type { AppLayoutProps, ContentWidth } from '@/types';

const WIDTHS: Record<ContentWidth, string> = {
    default: 'max-w-7xl',
    wide: 'max-w-none',
};

/**
 * Authenticated app shell: sidebar on desktop, top bar + bottom navigation on mobile, and the ⌘K
 * command palette. Pages that benefit from wide screens (calendar, reports) set the `wide` width
 * through layout props. The page's data is reloaded when the user comes back after a while.
 */
export default function AppLayout({
    breadcrumbs = [],
    width = 'default',
    compact = false,
    children,
}: AppLayoutProps) {
    const { t } = useTranslation();
    // Show time reported elsewhere when the user comes back to the app.
    useRefreshOnReturn();
    useTimerTitle();
    const hasTimer = Boolean(usePage().props.timer);

    return (
        <CommandPaletteProvider>
            <div className="min-h-svh bg-background">
                <AppSidebar className="fixed inset-y-0 left-0 z-20 hidden w-64 md:flex" />

                <div className="md:pl-64">
                    <MobileTopBar className="md:hidden" />

                    <main
                        className={`page-transition mx-auto w-full ${WIDTHS[width]} animate-enter px-4 pt-4 ${hasTimer ? 'pb-40' : 'pb-28'} md:px-8 ${compact ? 'md:pt-5 md:pb-4' : 'md:pt-8 md:pb-12'}`}
                    >
                        {breadcrumbs.length > 1 && (
                            <Breadcrumbs className="mb-6 hidden md:flex">
                                {breadcrumbs.map((item, index) => (
                                    <Breadcrumbs.Item
                                        key={toUrl(item.href)}
                                        href={
                                            index < breadcrumbs.length - 1
                                                ? toUrl(item.href)
                                                : undefined
                                        }
                                    >
                                        {t(item.title)}
                                    </Breadcrumbs.Item>
                                ))}
                            </Breadcrumbs>
                        )}
                        {children}
                    </main>
                </div>

                {/* Above the bottom navigation on mobile; the sidebar shows it on desktop. */}
                <RunningTimerCard
                    variant="bar"
                    className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 md:hidden"
                />
                <MobileBottomNav className="md:hidden" />
            </div>
        </CommandPaletteProvider>
    );
}
