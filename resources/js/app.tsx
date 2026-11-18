import { createInertiaApp, router } from '@inertiajs/react';
import { AppProviders } from '@/components/providers/app-providers';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { setUrlDefaults } from '@/wayfinder';

/**
 * Tenant routes are prefixed with the organization slug; Wayfinder fills it in from the current page.
 */
let currentOrganizationSlug: string | undefined;
setUrlDefaults(() => ({ current_organization: currentOrganizationSlug }));
router.on('navigate', (event) => {
    currentOrganizationSlug =
        event.detail.page.props.currentOrganization?.slug ?? undefined;
});

const appName = import.meta.env.VITE_APP_NAME || 'BH Timetracker';

void createInertiaApp({
    title: (title) => (title ? `${title} – ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name.startsWith('auth/'):
            case name === 'onboarding':
            case name === 'error':
                return AuthLayout;
            case name.startsWith('settings/'):
            case name.startsWith('organizations/'):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app, { page }) {
        currentOrganizationSlug = page.props.currentOrganization?.slug;

        return <AppProviders locale={page.props.locale}>{app}</AppProviders>;
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
