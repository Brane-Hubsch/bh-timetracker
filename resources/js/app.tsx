import { createInertiaApp } from '@inertiajs/react';
import { AppProviders } from '@/components/providers/app-providers';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';

const appName = import.meta.env.VITE_APP_NAME || 'BH Timetracker';

void createInertiaApp({
    title: (title) => (title ? `${title} – ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
                return null;
            case name.startsWith('auth/'):
            case name === 'onboarding':
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
        return <AppProviders locale={page.props.locale}>{app}</AppProviders>;
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
