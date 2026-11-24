import { Avatar, Button } from '@heroui/react';
import { router } from '@inertiajs/react';
import { Banknote, X } from 'lucide-react';
import { LogoImage } from '@/components/logo-image';
import { ProjectDot } from '@/components/project-dot';
import { FilterChip } from '@/components/reports/filter-chip';
import type { FilterOption } from '@/components/reports/filter-chip';
import { PeriodPicker } from '@/components/reports/period-picker';
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from '@/lib/i18n';
import { reportQuery } from '@/lib/reports';
import { cn } from '@/lib/utils';
import type { ReportFilterValues, ReportOptions } from '@/types';

type Props = {
    filters: ReportFilterValues;
    options: ReportOptions;
    /** ISO weekday the organization's weeks start on (1 = Monday). */
    weekStartsOn: number;
};

function MemberAvatar({
    name,
    src,
    size,
}: {
    name: string;
    src: string | null;
    size: 'sm' | 'md';
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
                    : 'size-7',
            )}
            aria-hidden="true"
        >
            {src && <Avatar.Image src={src} alt="" className="object-cover" />}
            <Avatar.Fallback
                className={
                    size === 'sm'
                        ? 'text-[9px] leading-none font-semibold'
                        : 'text-[11px]'
                }
            >
                {/* The small, overlapping avatars only have room for one letter. */}
                {size === 'sm'
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

/**
 * Period and filters as one toolbar above the report: the period with previous/next arrows, then
 * a button per filter that shows what it narrows to (avatars, logos, colours). Every change updates
 * the URL, so reports can be bookmarked and shared. On mobile the filter buttons scroll sideways.
 */
export function ReportFilterBar({ filters, options, weekStartsOn }: Props) {
    const { t } = useTranslation();

    const apply = (changes: Partial<ReportFilterValues>) =>
        router.get(window.location.pathname, reportQuery(filters, changes), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });

    const activeFilters =
        [
            filters.members,
            filters.clients,
            filters.projects,
            filters.tags,
        ].filter((values) => values.length > 0).length +
        (filters.billable === null ? 0 : 1);

    const clearFilters = () =>
        apply({
            members: [],
            clients: [],
            projects: [],
            tags: [],
            billable: null,
        });

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

    const billableLabels: Record<string, string> = {
        all: t('All entries'),
        '1': t('Billable'),
        '0': t('Non-billable'),
    };

    return (
        <div
            className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-2"
            data-test="report-filters"
        >
            <PeriodPicker
                period={filters.period}
                from={filters.from}
                to={filters.to}
                periods={options.periods}
                weekStartsOn={weekStartsOn}
                onChange={(changes) => apply(changes)}
            />

            <div
                aria-hidden="true"
                className="mx-1 hidden h-5.5 w-px bg-separator md:block"
            />

            {/* Scrolls sideways on mobile instead of stacking the filters. */}
            <div className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-0.5 md:contents">
                {members.length > 0 && (
                    <FilterChip
                        label={t('Members')}
                        options={members}
                        statusSections={{
                            active: archiveSections.active,
                            inactive: t('Inactive (plural)'),
                        }}
                        value={filters.members}
                        onChange={(value) => apply({ members: value })}
                        fitOptionLabels
                        renderPreview={(shown) => (
                            <Stack className="-space-x-1">
                                {shown.slice(0, 3).map((option) => (
                                    <MemberAvatar
                                        key={option.value}
                                        name={option.label}
                                        src={
                                            memberAvatars.get(option.value)
                                                ?.avatar ?? null
                                        }
                                        size="sm"
                                    />
                                ))}
                            </Stack>
                        )}
                        data-test="report-members"
                    />
                )}

                {clients.length > 0 && (
                    <FilterChip
                        label={t('Clients')}
                        options={clients}
                        statusSections={archiveSections}
                        value={filters.clients}
                        onChange={(value) => apply({ clients: value })}
                        renderPreview={(shown) => (
                            <Stack className="-space-x-1">
                                {shown.slice(0, 3).map((option) => (
                                    <LogoImage
                                        key={option.value}
                                        src={
                                            clientLogos.get(option.value)
                                                ?.logo ?? null
                                        }
                                        name={option.label}
                                        size={20}
                                        className="rounded-md text-[10px] font-semibold ring-2 ring-background"
                                    />
                                ))}
                            </Stack>
                        )}
                        data-test="report-clients"
                    />
                )}

                {projects.length > 0 && (
                    <FilterChip
                        label={t('Projects')}
                        options={projects}
                        statusSections={archiveSections}
                        value={filters.projects}
                        onChange={(value) => apply({ projects: value })}
                        activeLabel={
                            filters.projects.length > 2
                                ? t(':count projects', {
                                      count: filters.projects.length,
                                  })
                                : undefined
                        }
                        renderPreview={(shown) => (
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
                        )}
                        data-test="report-projects"
                    />
                )}

                {options.tags.length > 0 && (
                    <FilterChip
                        label={t('Tags')}
                        options={options.tags}
                        value={filters.tags}
                        onChange={(value) => apply({ tags: value })}
                        data-test="report-tags"
                    />
                )}

                <FilterChip
                    label={t('Billing')}
                    options={Object.entries(billableLabels).map(
                        ([value, label]) => ({ value, label }),
                    )}
                    value={[filters.billable ?? 'all']}
                    onChange={([value]) =>
                        apply({
                            billable:
                                value === undefined || value === 'all'
                                    ? null
                                    : value,
                        })
                    }
                    selectionMode="single"
                    isActive={filters.billable !== null}
                    activeLabel={billableLabels[filters.billable ?? 'all']}
                    icon={
                        <Banknote
                            aria-hidden="true"
                            className="size-4 shrink-0"
                        />
                    }
                    data-test="report-billable"
                />

                {activeFilters > 0 && (
                    <Button
                        variant="ghost"
                        className="h-9 shrink-0 rounded-full"
                        onPress={clearFilters}
                        data-test="report-filters-clear"
                    >
                        <X className="size-4" />
                        {t('Clear filters')}
                    </Button>
                )}
            </div>
        </div>
    );
}
