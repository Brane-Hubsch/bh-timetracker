import { Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { useTranslation } from '@/lib/i18n';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const { t } = useTranslation();

    return (
        <main className="flex min-h-svh flex-col items-center justify-center bg-background p-4 sm:p-10">
            <div className="flex w-full max-w-sm flex-col gap-8">
                <div className="flex flex-col items-center gap-4">
                    <Link
                        href={home()}
                        className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground"
                    >
                        <AppLogoIcon className="size-7" />
                        <span className="sr-only">{t('Home')}</span>
                    </Link>

                    <div className="space-y-2 text-center">
                        {title && (
                            <h1 className="text-xl font-semibold">
                                {t(title)}
                            </h1>
                        )}
                        {description && (
                            <p className="text-sm text-muted">
                                {t(description)}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-6 rounded-2xl bg-surface p-6 shadow-surface">
                    {children}
                </div>
            </div>
        </main>
    );
}
