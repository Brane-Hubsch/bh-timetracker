import type { InertiaLinkProps } from '@inertiajs/react';
import { usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    Briefcase,
    CalendarDays,
    ChartColumn,
    FolderKanban,
    Tags,
    UsersRound,
} from 'lucide-react';
import { index as clients } from '@/routes/clients';
import { index as projects } from '@/routes/projects';
import { summary as reports } from '@/routes/reports';
import { index as tags } from '@/routes/tags';
import { index as team } from '@/routes/team';
import { index as time } from '@/routes/time';

export type MainNavItem = {
    /** Translation key (English source string). */
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon: LucideIcon;
    /** Shown in the mobile bottom navigation (others are under "More"). */
    mobile: boolean;
};

/**
 * Main navigation for the active organization. Without an active organization there is nothing to navigate to.
 */
export function useMainNavigation(): MainNavItem[] {
    const { currentOrganization, can } = usePage().props;

    if (!currentOrganization) {
        return [];
    }

    const slug = currentOrganization.slug;

    // The "Today" dashboard is paused: the calendar is the start page.
    return [
        {
            title: 'Calendar',
            href: time(slug),
            icon: CalendarDays,
            mobile: true,
        },
        {
            title: 'Reports',
            href: reports(slug),
            icon: ChartColumn,
            mobile: true,
        },
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
        ...(can?.canManageTags
            ? [
                  {
                      title: 'Tags',
                      href: tags(slug),
                      icon: Tags,
                      mobile: false,
                  },
              ]
            : []),
        ...(currentOrganization.hasTeam
            ? [
                  {
                      title: 'Team',
                      href: team(slug),
                      icon: UsersRound,
                      mobile: false,
                  },
              ]
            : []),
    ];
}
