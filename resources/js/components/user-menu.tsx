import { Avatar, Button, Dropdown, Label, Separator } from '@heroui/react';
import { router, usePage } from '@inertiajs/react';
import { LogOut, Settings } from 'lucide-react';
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from '@/lib/i18n';
import { logout } from '@/routes';
import { edit as editProfile } from '@/routes/profile';
import type { User } from '@/types/auth';

export function logoutAndFlush() {
    router.flushAll();
    router.visit(logout());
}

export function UserAvatar({
    user,
    className,
}: {
    user: Pick<User, 'name' | 'avatar'>;
    className?: string;
}) {
    const getInitials = useInitials();

    return (
        <Avatar size="sm" className={className}>
            {user.avatar && <Avatar.Image src={user.avatar} alt={user.name} />}
            <Avatar.Fallback>{getInitials(user.name)}</Avatar.Fallback>
        </Avatar>
    );
}

export function UserMenu() {
    const { t } = useTranslation();
    const { auth } = usePage().props;

    return (
        <Dropdown>
            <Button
                variant="ghost"
                isIconOnly
                aria-label={t('Account')}
                data-test="sidebar-menu-button"
            >
                <UserAvatar user={auth.user} />
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
