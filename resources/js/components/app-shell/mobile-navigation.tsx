import { Button, Drawer, Separator } from '@heroui/react';
import { Link } from '@inertiajs/react';
import { Building2, LogOut, Menu, Palette, Shield, User } from 'lucide-react';
import { useState } from 'react';
import AppLogo from '@/components/app-logo';
import { OrganizationSwitcher } from '@/components/organization-switcher';
import { UserMenu, logoutAndFlush } from '@/components/user-menu';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useTranslation } from '@/lib/i18n';
import { useMainNavigation } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { home } from '@/routes';
import { edit as editAppearance } from '@/routes/appearance';
import { index as organizations } from '@/routes/organizations';
import { edit as editProfile } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';

/**
 * Top bar on small screens: logo, organization switcher and account menu.
 */
export function MobileTopBar({ className }: { className?: string }) {
    return (
        <header
            className={cn(
                'sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-separator bg-background/90 px-4 py-2 backdrop-blur',
                className,
            )}
        >
            <Link href={home()} aria-label="Home">
                <AppLogo />
            </Link>
            <div className="flex items-center gap-1">
                <OrganizationSwitcher compact />
                <UserMenu />
            </div>
        </header>
    );
}

/**
 * Bottom navigation on small screens (Today / … / More). "More" opens a bottom drawer with the
 * remaining destinations.
 */
export function MobileBottomNav({ className }: { className?: string }) {
    const { t } = useTranslation();
    const navigation = useMainNavigation();
    const items = navigation.filter((item) => item.mobile);
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const [isMoreOpen, setMoreOpen] = useState(false);

    const moreLinks = [
        ...navigation
            .filter((item) => !item.mobile)
            .map(({ title, href, icon }) => ({ title, href, icon })),
        { title: 'Profile', href: editProfile(), icon: User },
        { title: 'Security', href: editSecurity(), icon: Shield },
        { title: 'Organizations', href: organizations(), icon: Building2 },
        { title: 'Appearance', href: editAppearance(), icon: Palette },
    ];

    const itemClass =
        'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium';

    return (
        <>
            <nav
                aria-label={t('Main')}
                className={cn(
                    'fixed inset-x-0 bottom-0 z-30 flex border-t border-separator bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur',
                    className,
                )}
            >
                {items.map((item) => {
                    const isActive = isCurrentOrParentUrl(item.href);

                    return (
                        <Link
                            key={item.title}
                            href={item.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                                itemClass,
                                isActive ? 'text-accent' : 'text-muted',
                            )}
                        >
                            <item.icon className="size-5" />
                            {t(item.title)}
                        </Link>
                    );
                })}
                <button
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    className={cn(itemClass, 'text-muted')}
                    data-test="mobile-more-button"
                >
                    <Menu className="size-5" />
                    {t('More')}
                </button>
            </nav>

            <Drawer.Backdrop isOpen={isMoreOpen} onOpenChange={setMoreOpen}>
                <Drawer.Content placement="bottom">
                    <Drawer.Dialog>
                        <Drawer.Handle />
                        <Drawer.Header>
                            <Drawer.Heading>{t('More')}</Drawer.Heading>
                        </Drawer.Header>
                        <Drawer.Body className="grid gap-1 pb-6">
                            {moreLinks.map((link) => (
                                <Link
                                    key={link.title}
                                    href={link.href}
                                    onClick={() => setMoreOpen(false)}
                                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-default"
                                >
                                    <link.icon className="size-5 text-muted" />
                                    {t(link.title)}
                                </Link>
                            ))}
                            <Separator className="my-2" />
                            <Button
                                variant="ghost"
                                className="justify-start gap-3 px-3"
                                onPress={logoutAndFlush}
                            >
                                <LogOut className="size-5 text-muted" />
                                {t('Log out')}
                            </Button>
                        </Drawer.Body>
                    </Drawer.Dialog>
                </Drawer.Content>
            </Drawer.Backdrop>
        </>
    );
}
