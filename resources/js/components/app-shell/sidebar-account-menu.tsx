import { Button, Popover, Separator } from '@heroui/react';
import { Link, usePage } from '@inertiajs/react';
import { Keyboard } from 'lucide-react';
import { useState } from 'react';
import checkIcon from '@/assets/account-check.svg';
import logoutIcon from '@/assets/account-logout.svg';
import organizationIcon from '@/assets/account-organization.svg';
import plusIcon from '@/assets/account-plus.svg';
import settingsIcon from '@/assets/account-settings.svg';
import CreateOrganizationModal from '@/components/create-organization-modal';
import { LogoImage } from '@/components/logo-image';
import { UserAvatar, logoutAndFlush } from '@/components/user-menu';
import { useSwitchOrganization } from '@/hooks/use-switch-organization';
import { useTranslation } from '@/lib/i18n';
import { triggerShortcut } from '@/lib/shortcuts';
import { cn } from '@/lib/utils';
import { edit as editOrganization } from '@/routes/organizations';
import { edit as editProfile } from '@/routes/profile';
import type { User } from '@/types/auth';

const rowClassName =
    'flex min-h-9 w-full items-center justify-start gap-2 rounded-lg px-2 py-1 text-left text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus focus-visible:outline-none';

function AccountDetails({ user }: { user: Pick<User, 'name' | 'email'> }) {
    return (
        <span className="min-w-0 text-left">
            <span className="block truncate text-sm font-medium">
                {user.name}
            </span>
            <span className="block truncate text-xs font-normal text-muted">
                {user.email}
            </span>
        </span>
    );
}

function AccountIcon({ src, className }: { src: string; className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'size-4 shrink-0 bg-current mask-center mask-no-repeat text-muted',
                className,
            )}
            style={{ maskImage: `url(${src})` }}
        />
    );
}

export function SidebarAccountMenu() {
    const { t } = useTranslation();
    const { auth, currentOrganization, organizations } = usePage().props;
    const { user } = auth;
    const [isOpen, setIsOpen] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const switchOrganization = useSwitchOrganization();

    return (
        <>
            <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
                <Button
                    variant="ghost"
                    aria-label={t('Account')}
                    className={cn(
                        'h-11 w-full justify-start gap-1.5 rounded-lg border border-transparent px-[7px] text-foreground active:transform-none data-[pressed=true]:transform-none',
                        isOpen && 'border-separator bg-surface-secondary',
                    )}
                    data-test="sidebar-menu-button"
                >
                    <span
                        aria-hidden="true"
                        className="relative size-[42px] shrink-0"
                    >
                        <UserAvatar
                            user={user}
                            className={cn(
                                'absolute top-0.5 left-0 size-8',
                                currentOrganization &&
                                    'sidebar-account-avatar-cutout',
                            )}
                        />
                        {currentOrganization && (
                            <LogoImage
                                src={currentOrganization.logo}
                                name={currentOrganization.name}
                                size={16}
                                fit="cover"
                                className={cn(
                                    'absolute top-[22px] left-[21px] rounded-sm',
                                    currentOrganization.logo && 'bg-white',
                                )}
                            />
                        )}
                    </span>
                    <AccountDetails user={user} />
                </Button>
                <Popover.Content
                    placement="top start"
                    className="w-58 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-[22px] p-0"
                >
                    <Popover.Dialog
                        aria-label={t('Account')}
                        className="grid gap-0.5 p-1.5"
                        data-test="sidebar-account-menu"
                    >
                        <div className="flex h-[46px] items-center gap-2 px-2">
                            <UserAvatar
                                user={user}
                                className="size-8 shrink-0"
                            />
                            <AccountDetails user={user} />
                        </div>
                        <Separator className="mx-0.5" />

                        <div
                            role="group"
                            aria-label={t('Organization')}
                            className="grid gap-0.5"
                        >
                            <div className="flex items-center justify-between ps-2 pe-0.5">
                                <span className="text-xs font-medium text-muted">
                                    {t('Organization')}
                                </span>
                                <Button
                                    isIconOnly
                                    variant="ghost"
                                    aria-label={t('New organization')}
                                    className="size-7 rounded-lg"
                                    onPress={() => {
                                        setIsOpen(false);
                                        setIsCreateOpen(true);
                                    }}
                                    data-test="organization-switcher-new-organization"
                                >
                                    <AccountIcon src={plusIcon} />
                                </Button>
                            </div>
                            {organizations.map((organization) => {
                                const isCurrent =
                                    organization.id === currentOrganization?.id;

                                return (
                                    <Button
                                        key={organization.id}
                                        variant="ghost"
                                        aria-current={isCurrent || undefined}
                                        className={cn(
                                            rowClassName,
                                            isCurrent && 'bg-surface-secondary',
                                        )}
                                        onPress={() => {
                                            setIsOpen(false);

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
                                            size={24}
                                            fit="cover"
                                        />
                                        <span className="min-w-0 flex-1 truncate">
                                            {organization.name}
                                        </span>
                                        {isCurrent && (
                                            <AccountIcon
                                                src={checkIcon}
                                                className="text-foreground"
                                            />
                                        )}
                                    </Button>
                                );
                            })}
                        </div>
                        <Separator className="mx-0.5" />

                        {currentOrganization && (
                            <Link
                                href={editOrganization(
                                    currentOrganization.slug,
                                )}
                                className={rowClassName}
                                onClick={() => setIsOpen(false)}
                            >
                                <AccountIcon src={organizationIcon} />
                                {t('Organization settings')}
                            </Link>
                        )}
                        <Link
                            href={editProfile()}
                            className={rowClassName}
                            onClick={() => setIsOpen(false)}
                        >
                            <AccountIcon src={settingsIcon} />
                            {t('Profile settings')}
                        </Link>
                        <Separator className="mx-0.5" />

                        <Button
                            variant="ghost"
                            className={rowClassName}
                            onPress={() => {
                                setIsOpen(false);
                                window.setTimeout(
                                    () => triggerShortcut('help'),
                                    0,
                                );
                            }}
                            data-test="keyboard-shortcuts-menu-item"
                        >
                            <Keyboard
                                aria-hidden="true"
                                className="size-4 shrink-0 text-muted"
                            />
                            {t('Keyboard shortcuts')}
                        </Button>
                        <Button
                            variant="ghost"
                            className={rowClassName}
                            onPress={() => {
                                setIsOpen(false);
                                logoutAndFlush();
                            }}
                            data-test="logout-button"
                        >
                            <AccountIcon src={logoutIcon} />
                            {t('Log out')}
                        </Button>
                    </Popover.Dialog>
                </Popover.Content>
            </Popover>
            <CreateOrganizationModal
                isOpen={isCreateOpen}
                onOpenChange={setIsCreateOpen}
            />
        </>
    );
}
