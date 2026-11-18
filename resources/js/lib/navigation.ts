import type { InertiaLinkProps } from '@inertiajs/react';
import { usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { House } from 'lucide-react';
import { dashboard } from '@/routes';

export type MainNavItem = {
    /** Translation key (English source string). */
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon: LucideIcon;
    /** Shown in the mobile bottom navigation. */
    mobile: boolean;
};

/**
 * Main navigation for the active organization. New sections (calendar, reports, ...) are added here
 * in their phases. Without an active organization there is nothing to navigate to.
 */
export function useMainNavigation(): MainNavItem[] {
    const { currentOrganization } = usePage().props;

    if (!currentOrganization) {
        return [];
    }

    return [
        {
            title: 'Today',
            href: dashboard(currentOrganization.slug),
            icon: House,
            mobile: true,
        },
    ];
}
