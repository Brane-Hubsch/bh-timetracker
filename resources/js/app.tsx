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
router.on('navigate', ({ detail: { page } }) => {
    const slug = page.props.currentOrganization?.slug;
    if (slug !== currentOrganizationSlug) {
        router.flushAll();
    }
    currentOrganizationSlug = slug;
});

router.on('start', ({ detail: { visit } }) => {
    if (visit.method !== 'get' && visit.method !== 'query') {
        router.flushAll();
    }
});
router.on('finish', ({ detail: { visit } }) => {
    // Discard any prefetches that started while the write was in flight.
    if (visit.method !== 'get' && visit.method !== 'query') {
        router.flushAll();
    }
});

void createInertiaApp({
    title: (title, page) =>
        [page.props.name, title].filter(Boolean).join(' | '),
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
        color: '#7c3aed',
        delay: 200,
    },
});

// This will set light / dark mode on load...
initializeTheme();
