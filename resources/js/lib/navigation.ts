import type { InertiaLinkProps } from '@inertiajs/react';
import { usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    Briefcase,
    CalendarDays,
    ChartColumn,
    FolderKanban,
    List,
    Tags,
    UsersRound,
} from 'lucide-react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { index as clients } from '@/routes/clients';
import { index as projects } from '@/routes/projects';
import { summary as reports } from '@/routes/reports';
import { index as tags } from '@/routes/tags';
import { index as team } from '@/routes/team';
import { index as timeCalendar, list as timeList } from '@/routes/time';

type NavigationProps = Pick<
    ReturnType<typeof usePage>['props'],
    'can' | 'currentOrganization'
>;

type NavigationEntry = {
    title: string;
    route: (slug: string) => NonNullable<InertiaLinkProps['href']>;
    icon: LucideIcon;
    exact?: boolean;
    isVisible?: (props: NavigationProps) => boolean;
};

// The "Today" dashboard is paused: the calendar is the start page.
const navigationEntries: readonly NavigationEntry[] = [
    {
        title: 'Calendar',
        route: timeCalendar,
        icon: CalendarDays,
        exact: true,
    },
    { title: 'List', route: timeList, icon: List, exact: true },
    { title: 'Reports', route: reports, icon: ChartColumn },
    { title: 'Projects', route: projects, icon: FolderKanban },
    {
        title: 'Clients',
        route: clients,
        icon: Briefcase,
        isVisible: ({ can }) => Boolean(can?.canManageClients),
    },
    {
        title: 'Tags',
        route: tags,
        icon: Tags,
        isVisible: ({ can }) => Boolean(can?.canManageTags),
    },
    {
        title: 'Team',
        route: team,
        icon: UsersRound,
        isVisible: ({ currentOrganization }) =>
            Boolean(currentOrganization?.hasTeam),
    },
];

export const mainNavigationOrder = navigationEntries.map(({ title }) => title);

export type MainNavItem = {
    /** Translation key (English source string). */
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon: LucideIcon;
    isActive?: boolean;
};

/**
 * Main navigation for the active organization. Without an active organization there is nothing to navigate to.
 */
export function useMainNavigation(): MainNavItem[] {
    const { props } = usePage();
    const { isCurrentUrl } = useCurrentUrl();
    const slug = props.currentOrganization?.slug;

    if (!slug) {
        return [];
    }

    return navigationEntries
        .filter((entry) => !entry.isVisible || entry.isVisible(props))
        .map(({ title, route, icon, exact }) => {
            const href = route(slug);

            return {
                title,
                href,
                icon,
                isActive: exact ? isCurrentUrl(href) : undefined,
            };
        });
}
