import { Button, Drawer, Separator } from '@heroui/react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    Building2,
    Check,
    LogOut,
    Menu,
    Plus,
    Search,
    User,
} from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';
import { BottomSheetBackdrop } from '@/components/bottom-sheet-backdrop';
import { useCommandPalette } from '@/components/command-palette';
import CreateOrganizationModal from '@/components/create-organization-modal';
import { LogoImage } from '@/components/logo-image';
import { UserAvatar, logoutAndFlush } from '@/components/user-menu';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
    useSidebarOrder,
    useSidebarSettings,
} from '@/hooks/use-sidebar-settings';
import { useSwitchOrganization } from '@/hooks/use-switch-organization';
import { useTranslation } from '@/lib/i18n';
import { useMainNavigation } from '@/lib/navigation';
import { cn, toUrl } from '@/lib/utils';
import { edit as editOrganization } from '@/routes/organizations';
import { edit as editProfile } from '@/routes/profile';
import { index as timeCalendar } from '@/routes/time';

const tabClass =
    'flex h-(--mobile-tab-height) min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px]/4 font-normal focus-visible:outline-focus';
const rowClass =
    'flex min-h-11 w-full items-center justify-start gap-3 rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-default focus-visible:outline-focus';
const iconClass = 'size-4 shrink-0 text-muted';
const drawerClass = 'max-h-[90svh] rounded-t-3xl bg-surface p-0';
const drawerBodyClass =
    'm-0! flex flex-col px-4 pt-2 pb-(--mobile-bottom-inset)';

export function MobileBottomNav({ className }: { className?: string }) {
    const { t } = useTranslation();
    const { component, props } = usePage();
    const { auth, can, currentOrganization } = props;
    const { user } = auth;
    const { isVisible } = useSidebarSettings();
    const navigation = useMainNavigation().filter(({ title }) =>
        isVisible(title),
    );
    const { order, byTitle } = useSidebarOrder(navigation);
    const { currentUrl, isCurrentOrParentUrl } = useCurrentUrl();
    const { open: openSearch } = useCommandPalette();
    const [isMoreOpen, setMoreOpen] = useState(false);
    const [isCreateOpen, setCreateOpen] = useState(false);
    const isMobile = useMediaQuery('(width < 48rem)');

    const [tabs, remaining] = [order.slice(0, 4), order.slice(4)].map(
        (titles) =>
            titles.map((title) => {
                const item = byTitle.get(title)!;

                return {
                    ...item,
                    isActive: item.isActive ?? isCurrentOrParentUrl(item.href),
                    href:
                        title === 'Calendar' && currentOrganization
                            ? timeCalendar(currentOrganization.slug, {
                                  query: { view: 'day' },
                              })
                            : item.href,
                };
            }),
    );
    const destinations = (isMoreOpen ? remaining : tabs).filter(
        ({ isActive }) => !isActive,
    );
    const prefetchUrls = destinations.map(({ href }) => toUrl(href)).join('\n');

    const prefetchDestinations = useEffectEvent(() => {
        const { connection } = navigator as Navigator & {
            connection?: { saveData?: boolean };
        };
        if (document.hidden || !navigator.onLine || connection?.saveData) {
            return;
        }

        for (const { href, page } of destinations) {
            if (page !== component) {
                // A speculative import can fail without blocking navigation.
                void router.resolveComponent(page).catch(() => {});
            }

            if (!router.getCached(href) && !router.getPrefetching(href)) {
                router.prefetch(href);
            }
        }
    });

    useEffect(() => {
        if (!isMobile || !user.email_verified_at || !prefetchUrls) {
            return;
        }

        // Use the splash's existing display time without blocking dismissal on the network.
        const delay = document.documentElement.classList.contains('splash')
            ? 0
            : 200;
        const timeout = window.setTimeout(() => prefetchDestinations(), delay);

        return () => window.clearTimeout(timeout);
    }, [isMobile, prefetchUrls, user.email_verified_at]);

    const organizationSettings = currentOrganization
        ? editOrganization(currentOrganization.slug)
        : null;
    const isMoreActive =
        currentUrl.startsWith('/settings/') ||
        remaining.some(({ isActive }) => isActive);
    const closeMore = () => setMoreOpen(false);

    return (
        <>
            <Drawer isOpen={isMoreOpen} onOpenChange={setMoreOpen}>
                <nav
                    aria-label={t('Main')}
                    className={cn(
                        'mobile-tab-bar fixed inset-x-0 bottom-0 z-30 flex border-t border-separator bg-surface px-4 pb-(--mobile-tab-bar-inset) shadow-[0_-2px_8px_#0000000a]',
                        className,
                    )}
                >
                    {tabs.map((item) => (
                        <Link
                            key={item.title}
                            href={item.href}
                            aria-current={item.isActive ? 'page' : undefined}
                            className={cn(
                                tabClass,
                                item.isActive ? 'text-accent' : 'text-muted',
                            )}
                        >
                            <item.icon
                                aria-hidden="true"
                                className="size-[22px]"
                            />
                            <span className="max-w-full truncate">
                                {t(item.title)}
                            </span>
                        </Link>
                    ))}
                    <Drawer.Trigger
                        aria-current={isMoreActive ? 'page' : undefined}
                        className={cn(
                            tabClass,
                            isMoreActive ? 'text-accent' : 'text-muted',
                        )}
                        data-test="mobile-more-button"
                    >
                        <Menu aria-hidden="true" className="size-[22px]" />
                        {t('More')}
                    </Drawer.Trigger>
                </nav>

                <BottomSheetBackdrop>
                    <Drawer.Content
                        placement="bottom"
                        className="[--sheet-height-limit:90svh]"
                    >
                        <Drawer.Dialog
                            aria-label={t('More')}
                            className={drawerClass}
                        >
                            <Drawer.Handle className="pt-2 pb-0" />
                            <Drawer.Body className={drawerBodyClass}>
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <Link
                                        href={editProfile()}
                                        aria-label={t('Profile settings')}
                                        onClick={closeMore}
                                        className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg text-foreground focus-visible:outline-focus"
                                    >
                                        <UserAvatar
                                            user={user}
                                            className="size-10 shrink-0 [--avatar-radius:9999px]"
                                        />
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium">
                                                {user.name}
                                            </span>
                                            <span className="block truncate text-xs text-muted">
                                                {user.email}
                                            </span>
                                        </span>
                                    </Link>
                                    <MobileOrganizationSwitcher
                                        onDismiss={closeMore}
                                        onCreate={() => setCreateOpen(true)}
                                    />
                                </div>

                                {isVisible('Search') && (
                                    <button
                                        type="button"
                                        className="mt-1 mb-3 flex min-h-11 items-center gap-2 rounded-lg bg-background px-3 text-sm text-muted shadow-[inset_0_1px_3px_#0000000d] focus-visible:outline-focus"
                                        onClick={() => {
                                            closeMore();
                                            openSearch();
                                        }}
                                        data-test="mobile-more-search"
                                    >
                                        <Search
                                            aria-hidden="true"
                                            className={iconClass}
                                        />
                                        {t('Search…')}
                                    </button>
                                )}
                                {remaining.map((item) => (
                                    <Link
                                        key={item.title}
                                        href={item.href}
                                        onClick={closeMore}
                                        aria-current={
                                            item.isActive ? 'page' : undefined
                                        }
                                        className={cn(
                                            rowClass,
                                            item.isActive && 'bg-default',
                                        )}
                                    >
                                        <item.icon
                                            aria-hidden="true"
                                            className={iconClass}
                                        />
                                        {t(item.title)}
                                    </Link>
                                ))}
                                {remaining.length > 0 && (
                                    <Separator className="my-2" />
                                )}
                                <Link
                                    href={editProfile()}
                                    className={rowClass}
                                    onClick={closeMore}
                                >
                                    <User
                                        aria-hidden="true"
                                        className={iconClass}
                                    />
                                    {t('Profile settings')}
                                </Link>
                                {can?.canUpdateOrganization &&
                                    organizationSettings && (
                                        <Link
                                            href={organizationSettings}
                                            className={rowClass}
                                            onClick={closeMore}
                                        >
                                            <Building2
                                                aria-hidden="true"
                                                className={iconClass}
                                            />
                                            {t('Organization settings')}
                                        </Link>
                                    )}
                                <Separator className="my-2" />
                                <Button
                                    variant="ghost"
                                    className={rowClass}
                                    onPress={() => {
                                        closeMore();
                                        logoutAndFlush();
                                    }}
                                >
                                    <LogOut
                                        aria-hidden="true"
                                        className={iconClass}
                                    />
                                    {t('Log out')}
                                </Button>
                            </Drawer.Body>
                        </Drawer.Dialog>
                    </Drawer.Content>
                </BottomSheetBackdrop>
            </Drawer>
            <CreateOrganizationModal
                isOpen={isCreateOpen}
                onOpenChange={setCreateOpen}
            />
        </>
    );
}

function MobileOrganizationSwitcher({
    onDismiss,
    onCreate,
}: {
    onDismiss: () => void;
    onCreate: () => void;
}) {
    const { t } = useTranslation();
    const { currentOrganization, organizations } = usePage().props;
    const switchOrganization = useSwitchOrganization();
    const [isOpen, setOpen] = useState(false);
    const closePanels = () => {
        setOpen(false);
        onDismiss();
    };

    return (
        <Drawer isOpen={isOpen} onOpenChange={setOpen}>
            <Drawer.Trigger
                aria-label={t('Switch organization')}
                className="grid size-11 shrink-0 place-items-center rounded-lg focus-visible:outline-focus"
                data-test="mobile-organization-switcher"
            >
                {currentOrganization ? (
                    <LogoImage
                        src={currentOrganization.logo}
                        name={currentOrganization.name}
                        size={40}
                        fit="cover"
                    />
                ) : (
                    <Building2
                        aria-hidden="true"
                        className="size-5 text-muted"
                    />
                )}
            </Drawer.Trigger>
            <Drawer.Backdrop>
                <Drawer.Content placement="bottom">
                    <Drawer.Dialog className={drawerClass}>
                        <Drawer.Handle className="pt-2 pb-0" />
                        <Drawer.Header className="px-4 pt-2 pb-0">
                            <Drawer.Heading className="text-sm font-medium text-muted">
                                {t('Organizations')}
                            </Drawer.Heading>
                        </Drawer.Header>
                        <Drawer.Body className={drawerBodyClass}>
                            {organizations.map((organization) => {
                                const isCurrent =
                                    organization.id === currentOrganization?.id;

                                return (
                                    <Button
                                        key={organization.id}
                                        variant="ghost"
                                        aria-current={isCurrent || undefined}
                                        className={cn(
                                            rowClass,
                                            'min-h-14 px-1 text-base',
                                        )}
                                        onPress={() => {
                                            closePanels();
                                            if (!isCurrent) {
                                                switchOrganization(
                                                    organization,
                                                );
                                            }
                                        }}
                                        data-test="organization-switcher-item"
                                    >
                                        <LogoImage
                                            src={organization.logo}
                                            name={organization.name}
                                            size={36}
                                            fit="cover"
                                        />
                                        <span className="min-w-0 flex-1 truncate text-left">
                                            {organization.name}
                                        </span>
                                        {isCurrent && (
                                            <Check
                                                aria-hidden="true"
                                                className="size-5 shrink-0 text-accent"
                                            />
                                        )}
                                    </Button>
                                );
                            })}
                            {organizations.length > 0 && (
                                <Separator className="my-2" />
                            )}
                            {currentOrganization && (
                                <Link
                                    href={editOrganization(
                                        currentOrganization.slug,
                                    )}
                                    className={rowClass}
                                    onClick={closePanels}
                                >
                                    <Building2
                                        aria-hidden="true"
                                        className={iconClass}
                                    />
                                    {t('Organization settings')}
                                </Link>
                            )}
                            <Button
                                variant="ghost"
                                className={rowClass}
                                onPress={() => {
                                    closePanels();
                                    onCreate();
                                }}
                                data-test="organization-switcher-new-organization"
                            >
                                <Plus
                                    aria-hidden="true"
                                    className={iconClass}
                                />
                                {t('New organization')}
                            </Button>
                        </Drawer.Body>
                    </Drawer.Dialog>
                </Drawer.Content>
            </Drawer.Backdrop>
        </Drawer>
    );
}
