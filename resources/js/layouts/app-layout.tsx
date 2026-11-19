import { Breadcrumbs } from '@heroui/react';
import type { ReactNode } from 'react';
import { AppSidebar } from '@/components/app-shell/app-sidebar';
import { CommandPaletteProvider } from '@/components/command-palette';
import {
    MobileBottomNav,
    MobileTopBar,
} from '@/components/app-shell/mobile-navigation';
import { useTranslation } from '@/lib/i18n';
import { toUrl } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

/**
 * Authenticated app shell: sidebar on desktop, top bar + bottom navigation on mobile, and the ⌘K
 * command palette.
 */
export default function AppLayout({
    breadcrumbs = [],
    children,
}: {
    breadcrumbs?: BreadcrumbItem[];
    children: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <CommandPaletteProvider>
            <div className="min-h-svh bg-background">
                <AppSidebar className="fixed inset-y-0 left-0 z-20 hidden w-64 md:flex" />

                <div className="md:pl-64">
                    <MobileTopBar className="md:hidden" />

                    <main className="page-transition mx-auto w-full max-w-5xl animate-enter px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-12">
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

                <MobileBottomNav className="md:hidden" />
            </div>
        </CommandPaletteProvider>
    );
}
