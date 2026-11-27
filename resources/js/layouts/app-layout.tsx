import { Breadcrumbs } from '@heroui/react';
import { AppSidebar } from '@/components/app-shell/app-sidebar';
import { InstallPrompt } from '@/components/app-shell/install-prompt';
import { MobilePageHeaderHost } from '@/components/app-shell/mobile-page-header';
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
    const [mobileHeaderHost, setMobileHeaderHost] =
        useState<HTMLDivElement | null>(null);
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
                    <div
                        ref={setMobileHeaderHost}
                        className="fixed inset-x-0 top-0 z-20 bg-surface md:hidden"
                    />
                    <main
                        className={cn(
                            'mx-auto w-full px-4 pt-[calc(1rem+env(safe-area-inset-top))] md:px-8',
                            WIDTHS[width],
                            compact ? 'md:pt-5 md:pb-4' : 'md:pt-8 md:pb-12',
                            'max-md:has-[.mobile-page-header-spacer]:min-h-svh max-md:has-[.mobile-page-header-spacer]:bg-surface max-md:has-[.mobile-page-header-spacer]:px-0 max-md:has-[.mobile-page-header-spacer]:pt-0 dark:max-md:has-[.mobile-page-header-spacer]:bg-background',
                            hasTimer
                                ? 'pb-[calc(var(--mobile-tab-bar-height)+6.4375rem)] max-md:has-[.mobile-page-header-spacer]:pb-[calc(var(--mobile-tab-bar-height)+var(--mobile-timer-space))]'
                                : 'pb-[calc(var(--mobile-tab-bar-height)+3.4375rem)] max-md:has-[.mobile-page-header-spacer]:pb-(--mobile-tab-bar-height)',
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
                        <MobilePageHeaderHost value={mobileHeaderHost}>
                            {children}
                        </MobilePageHeaderHost>
                    </main>
                </div>

                {/* Above the bottom navigation on mobile; the sidebar shows it on desktop. */}
                <RunningTimerCard
                    variant="bar"
                    className="fixed inset-x-3 bottom-[calc(var(--mobile-tab-bar-height)+0.6875rem)] z-30 md:hidden"
                />
                <MobileBottomNav className="md:hidden" />
                <InstallPrompt hasTimer={hasTimer} />
                <KeyboardShortcutsDialog />
            </div>
        </CommandPaletteProvider>
    );
}
