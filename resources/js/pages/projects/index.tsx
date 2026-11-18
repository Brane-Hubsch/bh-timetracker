import { Chip, buttonVariants } from '@heroui/react';
import { Head, Link, usePage } from '@inertiajs/react';
import { ChevronRight, FolderKanban, Lock, Plus } from 'lucide-react';
import { SelectField } from '@/components/form/select-field';
import Heading from '@/components/heading';
import { ListFilters } from '@/components/list-filters';
import { ProjectDot } from '@/components/project-dot';
import { formatHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { create, show } from '@/routes/projects';
import type { ProjectListItem } from '@/types';

type Props = {
    projects: ProjectListItem[];
    clients: { id: number; name: string }[];
    filters: {
        search: string;
        status: 'active' | 'archived';
        client: number | null;
    };
};

const ALL = 'all';

export default function ProjectsIndex({ projects, clients, filters }: Props) {
    const { t, intlLocale } = useTranslation();
    const { can } = usePage().props;

    return (
        <>
            <Head title={t('Projects')} />

            <div className="grid gap-6">
                <Heading
                    title={t('Projects')}
                    actions={
                        can?.canManageProjects && (
                            <Link
                                href={create()}
                                className={buttonVariants()}
                                data-test="new-project-button"
                            >
                                <Plus className="size-4" />
                                {t('New project')}
                            </Link>
                        )
                    }
                />

                <ListFilters filters={filters}>
                    {(apply) =>
                        clients.length > 0 && (
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
                                        client: value === ALL ? null : value,
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
                        )
                    }
                </ListFilters>

                <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface shadow-surface">
                    {projects.map((project) => (
                        <li key={project.id} data-test="project-row">
                            <Link
                                href={show({ project: project.id })}
                                className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-secondary"
                            >
                                <ProjectDot color={project.color} />
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate font-medium">
                                            {project.name}
                                        </span>
                                        {project.code && (
                                            <span className="text-sm text-muted">
                                                {project.code}
                                            </span>
                                        )}
                                        {project.isPrivate && (
                                            <Lock
                                                className="size-3.5 text-muted"
                                                aria-label={t('Private')}
                                            />
                                        )}
                                    </div>
                                    <p className="truncate text-sm text-muted">
                                        {[
                                            project.client?.name ??
                                                t('No client'),
                                            project.estimateSeconds !== null &&
                                                t('Estimate :hours', {
                                                    hours: formatHours(
                                                        project.estimateSeconds,
                                                        intlLocale,
                                                    ),
                                                }),
                                            !project.isBillable &&
                                                t('Not billable'),
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                </div>
                                {project.isArchived && (
                                    <Chip size="sm" variant="soft">
                                        {t('Archived')}
                                    </Chip>
                                )}
                                <ChevronRight className="size-4 shrink-0 text-muted" />
                            </Link>
                        </li>
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
        </>
    );
}
