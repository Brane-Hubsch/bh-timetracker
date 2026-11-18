import type { InertiaLinkProps } from '@inertiajs/react';
import { usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { Briefcase, FolderKanban, House } from 'lucide-react';
import { dashboard } from '@/routes';
import { index as clients } from '@/routes/clients';
import { index as projects } from '@/routes/projects';

export type MainNavItem = {
    /** Translation key (English source string). */
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon: LucideIcon;
    /** Shown in the mobile bottom navigation (others are under "More"). */
    mobile: boolean;
};

/**
 * Main navigation for the active organization. New sections (calendar, reports, ...) are added here
 * in their phases. Without an active organization there is nothing to navigate to.
 */
export function useMainNavigation(): MainNavItem[] {
    const { currentOrganization, can } = usePage().props;

    if (!currentOrganization) {
        return [];
    }

    const slug = currentOrganization.slug;

    return [
        { title: 'Today', href: dashboard(slug), icon: House, mobile: true },
        {
            title: 'Projects',
            href: projects(slug),
            icon: FolderKanban,
            mobile: false,
        },
        ...(can?.canManageClients
            ? [
                  {
                      title: 'Clients',
                      href: clients(slug),
                      icon: Briefcase,
                      mobile: false,
                  },
              ]
            : []),
    ];
}
