import { Breadcrumbs } from '@heroui/react';
import { AppSidebar } from '@/components/app-shell/app-sidebar';
import { SidebarResizeHandle } from '@/components/app-shell/sidebar-resize-handle';
import { CommandPaletteProvider } from '@/components/command-palette';
import { MobileBottomNav } from '@/components/app-shell/mobile-navigation';
import { usePage } from '@inertiajs/react';
import { useState, type CSSProperties } from 'react';
import {
    RunningTimerCard,
    useTimerTitle,
} from '@/components/time/running-timer';
import {
    KeyboardShortcutsDialog,
    useKeyboardShortcuts,
} from '@/components/keyboard-shortcuts';
import { useRefreshOnReturn } from '@/hooks/use-refresh-on-return';
import { useSyncSidebarSettings } from '@/hooks/use-sidebar-settings';
import { useTranslation } from '@/lib/i18n';
import { cn, toUrl } from '@/lib/utils';
import type { AppLayoutProps, ContentWidth } from '@/types';

const WIDTHS: Record<ContentWidth, string> = {
    default: 'max-w-7xl',
    wide: 'max-w-none',
};

/**
 * Authenticated app shell: sidebar on desktop, bottom navigation on mobile, and the ⌘K
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
    const [sidebarWidth, setSidebarWidth] = useState(256);
    // Show time reported elsewhere when the user comes back to the app.
    useRefreshOnReturn();
    useSyncSidebarSettings();
    useTimerTitle();
    useKeyboardShortcuts();
    const hasTimer = Boolean(usePage().props.timer);

    return (
        <CommandPaletteProvider>
            <div
                className="min-h-svh bg-background"
                style={
                    { '--sidebar-width': `${sidebarWidth}px` } as CSSProperties
                }
            >
                <AppSidebar className="fixed inset-y-0 left-0 z-20 hidden w-(--sidebar-width) md:flex" />
                <SidebarResizeHandle
                    width={sidebarWidth}
                    onResize={setSidebarWidth}
                />

                <div className="md:pl-(--sidebar-width)">
                    <main
                        className={cn(
                            'page-transition mx-auto w-full animate-enter px-4 pt-[calc(1rem+env(safe-area-inset-top))] md:px-8',
                            WIDTHS[width],
                            compact ? 'md:pt-5 md:pb-4' : 'md:pt-8 md:pb-12',
                            'max-md:has-[.mobile-calendar-header]:animate-none max-md:has-[.mobile-calendar-header]:bg-surface max-md:has-[.mobile-calendar-header]:px-0 max-md:has-[.mobile-calendar-header]:pt-0 dark:max-md:has-[.mobile-calendar-header]:bg-background',
                            'max-md:has-[.report-mobile-header]:animate-none max-md:has-[.report-mobile-header]:bg-surface max-md:has-[.report-mobile-header]:px-0 max-md:has-[.report-mobile-header]:pt-0 dark:max-md:has-[.report-mobile-header]:bg-background',
                            hasTimer
                                ? 'pb-[calc(10rem+env(safe-area-inset-bottom))] max-md:has-[.mobile-calendar-header]:pb-[calc(6.625rem+env(safe-area-inset-bottom))] max-md:has-[.report-mobile-header]:pb-[calc(6.625rem+env(safe-area-inset-bottom))]'
                                : 'pb-[calc(7rem+env(safe-area-inset-bottom))] max-md:has-[.mobile-calendar-header]:pb-[calc(3.5625rem+env(safe-area-inset-bottom))] max-md:has-[.report-mobile-header]:pb-[calc(3.5625rem+env(safe-area-inset-bottom))]',
                        )}
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
                <KeyboardShortcutsDialog />
            </div>
        </CommandPaletteProvider>
    );
}
