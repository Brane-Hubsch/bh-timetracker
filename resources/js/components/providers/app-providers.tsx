import { Toast } from '@heroui/react';
import { router } from '@inertiajs/react';
import { useEffect, type ReactNode } from 'react';
import { I18nProvider, RouterProvider } from 'react-aria-components';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { intlLocale } from '@/lib/i18n';
import { observeOverlayHeights } from '@/lib/overlay-height';

type AppProvidersProps = {
    /** The locale from the initial page load. Changing locale requires a full page reload. */
    locale: string;
    children: ReactNode;
};

/**
 * Global providers rendered around the Inertia app:
 * - RouterProvider: HeroUI/react-aria links and menu items navigate with Inertia instead of full reloads.
 * - I18nProvider: locale for react-aria date/number formatting.
 * - Toast.Provider: renders HeroUI toasts (flash messages from the backend included).
 */
export function AppProviders({ locale, children }: AppProvidersProps) {
    useFlashToast();
    useEffect(observeOverlayHeights, []);
    // The splash (resources/views/splash.blade.php) covers cold starts until the app has rendered.
    useEffect(() => window.hideSplash?.(), []);

    return (
        <RouterProvider
            navigate={(href, options) => router.visit(href, options)}
        >
            <I18nProvider locale={intlLocale(locale)}>
                {children}
                <Toast.Provider placement="bottom end" />
            </I18nProvider>
        </RouterProvider>
    );
}
