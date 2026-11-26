import { Avatar } from '@heroui/react';
import type { ReactNode } from 'react';
import { LogoImage } from '@/components/logo-image';
import { ProjectDot } from '@/components/project-dot';
import type { FilterOption } from '@/components/reports/filter-chip';
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ReportFilterValues, ReportOptions } from '@/types';

export type ReportSelection = 'members' | 'clients' | 'projects' | 'tags';

type ReportFilter = {
    key: ReportSelection;
    label: string;
    countLabel: string;
    searchLabel: string;
    options: FilterOption[];
    statusSections?: { active: string; inactive: string };
    renderPreview?: (options: FilterOption[]) => ReactNode;
};

export const clearReportFilters = {
    members: [],
    clients: [],
    projects: [],
    tags: [],
    billable: null,
} satisfies Partial<ReportFilterValues>;

export const reportBillingLabels = {
    all: 'All',
    '1': 'Billable (plural)',
    '0': 'Non-billable (plural)',
} as const;

export function activeReportFilters(filters: ReportFilterValues) {
    return (
        [
            filters.members,
            filters.clients,
            filters.projects,
            filters.tags,
        ].filter((values) => values.length > 0).length +
        Number(filters.billable !== null)
    );
}

export function MemberAvatar({
    name,
    src,
    size,
}: {
    name: string;
    src: string | null;
    size: 'xs' | 'sm' | 'md' | 'list';
}) {
    const getInitials = useInitials();

    return (
        <Avatar
            size="sm"
            variant="soft"
            color="accent"
            className={cn(
                'shrink-0 rounded-full',
                // The soft colour is translucent: an opaque base keeps overlapping avatars apart.
                size === 'sm'
                    ? 'size-5 bg-background ring-2 ring-background'
                    : { xs: 'size-4', md: 'size-7', list: 'size-6' }[size],
            )}
            aria-hidden="true"
        >
            {src && <Avatar.Image src={src} alt="" className="object-cover" />}
            <Avatar.Fallback
                className={
                    size === 'sm' || size === 'xs'
                        ? 'text-[9px] leading-none font-semibold'
                        : 'text-[11px]'
                }
            >
                {/* The small, overlapping avatars only have room for one letter. */}
                {size === 'sm' || size === 'xs'
                    ? getInitials(name).slice(0, 1)
                    : getInitials(name)}
            </Avatar.Fallback>
        </Avatar>
    );
}

/** Overlapping previews (avatars, logos, colours) at the start of a filter button. */
function Stack({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <span
            aria-hidden="true"
            className={cn('flex shrink-0 items-center -space-x-1.5', className)}
        >
            {children}
        </span>
    );
}

export function useReportFilterOptions(options: ReportOptions) {
    const { t } = useTranslation();

    const members: FilterOption[] = options.members.map((member) => ({
        value: member.value,
        label: member.label,
        isMuted: member.isInactive,
        isInactive: member.isInactive,
        leading: (
            <MemberAvatar name={member.label} src={member.avatar} size="md" />
        ),
    }));
    const memberAvatars = new Map(
        options.members.map((member) => [member.value, member]),
    );

    const clients: FilterOption[] = options.clients.map((client) => ({
        value: client.value,
        label: client.label,
        isInactive: client.isArchived,
        leading: <LogoImage src={client.logo} name={client.label} size={28} />,
    }));
    const clientLogos = new Map(
        options.clients.map((client) => [client.value, client]),
    );

    const projects: FilterOption[] = options.projects.map((project) => ({
        value: project.value,
        label: project.name,
        isInactive: project.isArchived,
        detail: project.client ?? undefined,
        leading: <ProjectDot color={project.color} />,
    }));
    const projectColors = new Map(
        options.projects.map((project) => [project.value, project.color]),
    );
    const archiveSections = {
        active: t('Active (plural)'),
        inactive: t('Archived (plural)'),
    };

    const filters: ReportFilter[] = [
        {
            key: 'members',
            label: t('Members'),
            countLabel: ':count members',
            searchLabel: t('Search members'),
            options: members,
            statusSections: {
                active: archiveSections.active,
                inactive: t('Inactive (plural)'),
            },
            renderPreview: (shown) => (
                <Stack className="-space-x-1">
                    {shown.slice(0, 3).map((option) => (
                        <MemberAvatar
                            key={option.value}
                            name={option.label}
                            src={
                                memberAvatars.get(option.value)?.avatar ?? null
                            }
                            size="sm"
                        />
                    ))}
                </Stack>
            ),
        },
        {
            key: 'clients',
            label: t('Clients'),
            countLabel: ':count clients',
            searchLabel: t('Search clients'),
            options: clients,
            statusSections: archiveSections,
            renderPreview: (shown) => (
                <Stack className="-space-x-1">
                    {shown.slice(0, 3).map((option) => (
                        <LogoImage
                            key={option.value}
                            src={clientLogos.get(option.value)?.logo ?? null}
                            name={option.label}
                            size={20}
                            className="rounded-md text-[10px] font-semibold ring-2 ring-background"
                        />
                    ))}
                </Stack>
            ),
        },
        {
            key: 'projects',
            label: t('Projects'),
            countLabel: ':count projects',
            searchLabel: t('Search projects'),
            options: projects,
            statusSections: archiveSections,
            renderPreview: (shown) => (
                <Stack className="-space-x-0.5">
                    {shown.slice(0, 3).map((option) => (
                        <span
                            key={option.value}
                            className="size-2.5 rounded-full ring-2 ring-background"
                            style={{
                                backgroundColor: projectColors.get(
                                    option.value,
                                ),
                            }}
                        />
                    ))}
                </Stack>
            ),
        },
        {
            key: 'tags',
            label: t('Tags'),
            countLabel: ':count tags',
            searchLabel: t('Search tags'),
            options: options.tags,
        },
    ];

    return filters.filter((filter) => filter.options.length > 0);
}
