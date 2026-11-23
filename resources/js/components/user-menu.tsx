import { Avatar, Button, Dropdown, Label, Separator } from '@heroui/react';
import { router, usePage } from '@inertiajs/react';
import { LogOut, Settings } from 'lucide-react';
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { logout } from '@/routes';
import { edit as editProfile } from '@/routes/profile';

export function logoutAndFlush() {
    router.flushAll();
    router.visit(logout());
}

type Props = {
    /** Show the user's name next to the avatar (desktop sidebar). */
    showName?: boolean;
    className?: string;
};

export function UserMenu({ showName = false, className }: Props) {
    const { t } = useTranslation();
    const { auth } = usePage().props;
    const getInitials = useInitials();

    return (
        <Dropdown>
            <Button
                variant="ghost"
                isIconOnly={!showName}
                className={cn(
                    showName && '-my-1 h-auto w-full justify-start gap-3 py-1',
                    className,
                )}
                aria-label={t('Account')}
                data-test="sidebar-menu-button"
            >
                <Avatar size="sm">
                    {auth.user.avatar && (
                        <Avatar.Image
                            src={auth.user.avatar}
                            alt={auth.user.name}
                        />
                    )}
                    <Avatar.Fallback>
                        {getInitials(auth.user.name)}
                    </Avatar.Fallback>
                </Avatar>
                {showName && (
                    <span className="min-w-0 text-left">
                        <span className="block truncate text-sm font-medium">
                            {auth.user.name}
                        </span>
                        <span className="block truncate text-xs text-muted">
                            {auth.user.email}
                        </span>
                    </span>
                )}
            </Button>
            <Dropdown.Popover placement="top start" className="min-w-56">
                <Dropdown.Menu
                    onAction={(key) => key === 'logout' && logoutAndFlush()}
                >
                    <Dropdown.Item
                        id="settings"
                        href={editProfile().url}
                        textValue={t('Settings')}
                    >
                        <Settings className="size-4" />
                        <Label>{t('Settings')}</Label>
                    </Dropdown.Item>
                    <Separator />
                    <Dropdown.Item
                        id="logout"
                        textValue={t('Log out')}
                        data-test="logout-button"
                    >
                        <LogOut className="size-4" />
                        <Label>{t('Log out')}</Label>
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}
