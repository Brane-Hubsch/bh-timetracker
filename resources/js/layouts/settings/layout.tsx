import { Link } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import Heading from '@/components/heading';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useTranslation } from '@/lib/i18n';
import { cn, toUrl } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { index as organizations } from '@/routes/organizations';
import { edit as editProfile } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';

const items = [
    { title: 'Profile', href: editProfile() },
    { title: 'Security', href: editSecurity() },
    { title: 'Organizations', href: organizations() },
    { title: 'Appearance', href: editAppearance() },
];

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { t } = useTranslation();
    const { isCurrentOrParentUrl } = useCurrentUrl();

    return (
        <div className="grid gap-6">
            <Heading
                title={t('Settings')}
                description={t('Your account, security and organizations.')}
            />

            <div className="flex flex-col gap-6 lg:flex-row lg:gap-12">
                <nav
                    aria-label={t('Settings')}
                    className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:w-48 lg:shrink-0 lg:flex-col lg:px-0"
                >
                    {items.map((item) => {
                        const isActive = isCurrentOrParentUrl(item.href);

                        return (
                            <Link
                                key={toUrl(item.href)}
                                href={item.href}
                                aria-current={isActive ? 'page' : undefined}
                                className={cn(
                                    'shrink-0 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-default',
                                    isActive
                                        ? 'bg-default text-foreground'
                                        : 'text-muted',
                                )}
                            >
                                {t(item.title)}
                            </Link>
                        );
                    })}
                </nav>

                <div className="grid max-w-2xl min-w-0 flex-1 content-start gap-10">
                    {children}
                </div>
            </div>
        </div>
    );
}
