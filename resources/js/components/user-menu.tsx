import { Avatar, Button, Dropdown, Label, Separator } from '@heroui/react';
import { router, usePage } from '@inertiajs/react';
import { Keyboard, LogOut, Settings } from 'lucide-react';
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from '@/lib/i18n';
import { triggerShortcut } from '@/lib/shortcuts';
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
                    onAction={(key) => {
                        if (key === 'logout') {
                            logoutAndFlush();
                        } else if (key === 'shortcuts') {
                            triggerShortcut('help');
                        }
                    }}
                >
                    <Dropdown.Item
                        id="settings"
                        href={editProfile().url}
                        textValue={t('Settings')}
                    >
                        <Settings className="size-4" />
                        <Label>{t('Settings')}</Label>
                    </Dropdown.Item>
                    <Dropdown.Item
                        id="shortcuts"
                        textValue={t('Keyboard shortcuts')}
                        className="hidden md:flex"
                        data-test="keyboard-shortcuts-menu-item"
                    >
                        <Keyboard className="size-4" />
                        <Label>{t('Keyboard shortcuts')}</Label>
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
