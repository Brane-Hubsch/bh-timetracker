import { Button, Chip } from '@heroui/react';
import { Head, Link, usePage } from '@inertiajs/react';
import { FolderKanban, Lock, Plus } from 'lucide-react';
import { Fragment, useState, type CSSProperties } from 'react';
import { SelectField } from '@/components/form/select-field';
import Heading from '@/components/heading';
import { ListFilters } from '@/components/list-filters';
import { LogoImage } from '@/components/logo-image';
import { EstimateProgress } from '@/components/estimate-progress';
import { ProjectDot } from '@/components/project-dot';
import { ProjectFormDrawer } from '@/components/projects/project-form-drawer';
import {
    ColumnOrderStatus,
    ReorderableColumnHeader,
    columnOrderHeaderClassName,
    useColumnOrder,
} from '@/components/reorderable-column-header';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useOpenFromQuery } from '@/hooks/use-open-from-query';
import { formatHours, formatMoney } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { show } from '@/routes/projects';
import type { ProjectFormOptions, ProjectListItem } from '@/types';

type Project = ProjectListItem & { hourlyRate: number | null };

type Props = {
    projects: Project[];
    /** Whether the viewer may see rates (owners and admins). */
    canViewRates: boolean;
    currency: string;
    clients: { id: number; name: string }[];
    filters: {
        search: string;
        status: 'active' | 'archived';
        client: number | null;
        /** '1' billable, '0' non-billable, null both. */
        billable: '1' | '0' | null;
    };
    /** Null when the viewer may not create projects. */
    projectForm: ProjectFormOptions | null;
};

const ALL = 'all';

const defaultColumnOrder = [
    'Client',
    'Billing',
    'Hourly rate',
    'Visibility',
    'Budget',
    'Reported',
] as const;

type ProjectColumn = (typeof defaultColumnOrder)[number];

const columnTracks: Record<ProjectColumn, string> = {
    Client: 'minmax(0, 1.4fr)',
    Billing: '8.5rem',
    'Hourly rate': '7rem',
    Visibility: '6rem',
    Budget: '8rem',
    Reported: '7rem',
};

export default function ProjectsIndex({
    projects,
    canViewRates,
    currency,
    clients,
    filters,
    projectForm,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const [isCreateOpen, setCreateOpen] = useState(false);
    const { id: userId } = usePage().props.auth.user;
    const isDesktop = useMediaQuery('(min-width: 80rem)');
    const order = useColumnOrder({
        storageKey: `timereport:project-list-column-order:${userId}`,
        defaultOrder: defaultColumnOrder,
        isVisible: (column) => canViewRates || column !== 'Hourly rate',
    });
    const gridStyle = {
        '--project-columns': [
            'minmax(0, 2.4fr)',
            ...order.columns.map((column) => columnTracks[column]),
        ].join(' '),
    } as CSSProperties;
    const billableCount = projects.filter(
        (project) => project.isBillable,
    ).length;
    const reportedSeconds = projects.reduce(
        (sum, project) => sum + project.consumedSeconds,
        0,
    );

    // ?new=1 from the command palette and links on other pages.
    useOpenFromQuery('new', () => setCreateOpen(projectForm !== null));

    return (
        <>
            <Head title={t('Projects')} />

            <div className="grid gap-6">
                <Heading
                    title={t('Projects')}
                    actions={
                        projectForm && (
                            <Button
                                onPress={() => setCreateOpen(true)}
                                data-test="new-project-button"
                            >
                                <Plus className="size-4" />
                                {t('New project')}
                            </Button>
                        )
                    }
                />

                <ListFilters
                    filters={filters}
                    className="sm:flex-wrap xl:flex-nowrap"
                >
                    {(apply) => (
                        <>
                            {clients.length > 0 && (
                                <SelectField
                                    name="client"
                                    label={
                                        <span className="sr-only">
                                            {t('Client')}
                                        </span>
                                    }
                                    value={
                                        filters.client
                                            ? String(filters.client)
                                            : ALL
                                    }
                                    onChange={(value) =>
                                        apply({
                                            client:
                                                value === ALL ? null : value,
                                        })
                                    }
                                    options={[
                                        { value: ALL, label: t('All clients') },
                                        ...clients.map((client) => ({
                                            value: String(client.id),
                                            label: client.name,
                                        })),
                                    ]}
                                    className="w-full sm:w-56"
                                />
                            )}
                            <SelectField
                                name="billable"
                                label={
                                    <span className="sr-only">
                                        {t('Billing')}
                                    </span>
                                }
                                value={filters.billable ?? ALL}
                                onChange={(value) =>
                                    apply({
                                        billable: value === ALL ? null : value,
                                    })
                                }
                                options={[
                                    { value: ALL, label: t('All projects') },
                                    {
                                        value: '1',
                                        label: t('Billable projects'),
                                    },
                                    {
                                        value: '0',
                                        label: t('Non-billable projects'),
                                    },
                                ]}
                                className="w-full sm:w-56"
                                data-test="project-billable-filter"
                            />
                        </>
                    )}
                </ListFilters>

                {projects.length > 0 && (
                    <dl
                        className="grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3"
                        data-test="project-summary"
                    >
                        {[
                            [t('Projects'), String(projects.length)],
                            [t('Billable'), String(billableCount)],
                            [
                                t('Reported'),
                                formatHours(reportedSeconds, intlLocale),
                            ],
                        ].map(([label, value]) => (
                            <div
                                key={label}
                                className="grid gap-0.5 rounded-2xl bg-surface px-4 py-3 shadow-surface"
                            >
                                <dt className="text-xs text-muted sm:text-sm">
                                    {label}
                                </dt>
                                <dd className="text-lg font-semibold tabular-nums">
                                    {value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}

                <div
                    className="overflow-hidden rounded-2xl bg-surface shadow-surface"
                    style={gridStyle}
                >
                    {projects.length > 0 && (
                        <>
                            <ColumnOrderStatus
                                announcement={order.announcement}
                            />
                            <div
                                className={`${columnOrderHeaderClassName} hidden items-center gap-x-6 border-b border-separator px-5 py-2.5 text-sm font-medium text-muted xl:grid xl:grid-cols-(--project-columns)`}
                            >
                                <span>{t('Project')}</span>
                                {order.columns.map((column) => (
                                    <ReorderableColumnHeader
                                        key={column}
                                        order={order}
                                        column={column}
                                        label={t(column)}
                                        align={
                                            column === 'Reported'
                                                ? 'end'
                                                : 'start'
                                        }
                                    />
                                ))}
                            </div>
                        </>
                    )}
                    <ul className="divide-y divide-separator">
                        {projects.map((project) => (
                            <ProjectRow
                                key={project.id}
                                project={project}
                                currency={currency}
                                canViewRates={canViewRates}
                                columns={isDesktop ? order.columns : null}
                            />
                        ))}
                        {projects.length === 0 && (
                            <li className="grid justify-items-center gap-2 p-10 text-center">
                                <FolderKanban className="size-6 text-muted" />
                                <p className="text-sm text-muted">
                                    {filters.search
                                        ? t('No projects match your search.')
                                        : filters.status === 'archived'
                                          ? t('No archived projects.')
                                          : t('No projects yet.')}
                                </p>
                            </li>
                        )}
                    </ul>
                </div>
            </div>

            {projectForm && (
                <ProjectFormDrawer
                    project={null}
                    options={projectForm}
                    isOpen={isCreateOpen}
                    onOpenChange={setCreateOpen}
                />
            )}
        </>
    );
}

type ProjectRowProps = {
    project: Project;
    currency: string;
    canViewRates: boolean;
    columns: readonly ProjectColumn[] | null;
};

function ProjectRow({
    project,
    currency,
    canViewRates,
    columns,
}: ProjectRowProps) {
    const { t, intlLocale } = useTranslation();
    const cells = {
        Client: (
            <div className="hidden min-w-0 items-center gap-2 text-sm xl:flex">
                {project.client ? (
                    <>
                        <LogoImage
                            src={project.client.logo}
                            name={project.client.name}
                            size={20}
                            className="rounded-md text-[10px] font-semibold"
                        />
                        <span className="truncate">{project.client.name}</span>
                    </>
                ) : (
                    <span className="text-muted">{t('No client')}</span>
                )}
            </div>
        ),
        Billing: (
            <span data-test="project-billable">
                {project.isBillable ? (
                    <Chip size="sm" variant="soft" color="accent">
                        {t('Billable')}
                    </Chip>
                ) : (
                    <>
                        <span
                            aria-hidden="true"
                            className="text-xs text-muted xl:text-sm"
                        >
                            –
                        </span>
                        <span className="sr-only">{t('Not billable')}</span>
                    </>
                )}
            </span>
        ),
        'Hourly rate': canViewRates && (
            <span
                className={`text-xs tabular-nums xl:text-sm ${project.hourlyRate === null ? 'hidden text-muted xl:inline' : 'rounded-full bg-surface-secondary px-2 py-0.5 xl:bg-transparent xl:p-0'}`}
                data-test="project-rate"
            >
                {project.hourlyRate !== null
                    ? `${formatMoney(project.hourlyRate, currency, intlLocale)}/h`
                    : project.isBillable
                      ? t('Default')
                      : '–'}
            </span>
        ),
        Visibility: (
            <span
                className={`items-center gap-1 text-xs text-muted xl:text-sm ${project.isPrivate ? 'flex rounded-full bg-surface-secondary px-2 py-0.5 xl:bg-transparent xl:p-0' : 'hidden xl:flex'}`}
            >
                {project.isPrivate && (
                    <Lock aria-hidden="true" className="size-3.5" />
                )}
                {project.isPrivate ? t('Private') : t('Public')}
            </span>
        ),
        Budget: (
            <div>
                <span
                    aria-hidden="true"
                    className="mb-0.5 block font-medium text-muted xl:hidden"
                >
                    {t('Budget')}
                </span>
                {project.estimateSeconds ? (
                    <EstimateProgress
                        consumedSeconds={project.consumedSeconds}
                        estimateSeconds={project.estimateSeconds}
                        display="budget"
                    />
                ) : (
                    <span className="text-xs text-muted">
                        <span aria-hidden="true">–</span>
                        <span className="sr-only">{t('No budget')}</span>
                    </span>
                )}
            </div>
        ),
        Reported: (
            <div className="text-right">
                <span className="mb-0.5 block font-medium text-muted xl:sr-only">
                    {t('Reported')}
                </span>
                <span className="tabular-nums xl:text-sm xl:font-medium">
                    {formatHours(project.consumedSeconds, intlLocale)}
                </span>
            </div>
        ),
    };

    return (
        <li data-test="project-row">
            <Link
                href={show({ project: project.slug })}
                className="grid gap-2.5 p-4 transition-colors hover:bg-surface-secondary xl:grid-cols-(--project-columns) xl:items-center xl:gap-x-6 xl:px-5 xl:py-3"
            >
                <div className="flex min-w-0 items-center gap-3">
                    <ProjectDot color={project.color} />
                    <div className="min-w-0">
                        <p className="flex items-center gap-2">
                            <span
                                className="truncate font-medium"
                                title={project.name}
                            >
                                {project.name}
                            </span>
                            {project.isArchived && (
                                <Chip size="sm" variant="soft">
                                    {t('Archived')}
                                </Chip>
                            )}
                        </p>
                        <p className="truncate text-xs text-muted">
                            <span className="xl:hidden">
                                {[
                                    project.client?.name ?? t('No client'),
                                    project.code,
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </span>
                            <span
                                className="hidden xl:inline"
                                data-test="project-code"
                            >
                                {project.code}
                            </span>
                        </p>
                    </div>
                </div>
                {columns ? (
                    columns.map((column) => (
                        <Fragment key={column}>{cells[column]}</Fragment>
                    ))
                ) : (
                    <>
                        {cells.Client}
                        <div className="flex flex-wrap items-center gap-1.5 pl-[22px] xl:contents">
                            {cells.Billing}
                            {cells['Hourly rate']}
                            {cells.Visibility}
                        </div>
                        <div className="grid grid-cols-2 gap-4 pl-[22px] text-xs xl:contents">
                            {cells.Budget}
                            {cells.Reported}
                        </div>
                    </>
                )}
            </Link>
        </li>
    );
}
