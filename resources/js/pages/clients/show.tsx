import { Button, Chip } from '@heroui/react';
import { Head, Link, router } from '@inertiajs/react';
import {
    Archive,
    ArchiveRestore,
    ChevronRight,
    Pencil,
    Plus,
} from 'lucide-react';
import { useState } from 'react';
import { LogoImage } from '@/components/logo-image';
import { ClientFormDrawer } from '@/components/client-form-drawer';
import Heading from '@/components/heading';
import { SelectField } from '@/components/form/select-field';
import type { SelectOption } from '@/components/form/select-field';
import { ProjectDot } from '@/components/project-dot';
import { ProjectFormDrawer } from '@/components/projects/project-form-drawer';
import { ReportStats } from '@/components/reports/report-stats';
import { formatDecimalHours, formatMoney } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { archive, index, restore } from '@/routes/clients';
import { show as showProject } from '@/routes/projects';
import { summary as reportSummary } from '@/routes/reports';
import type { ClientDetails, ProjectFormOptions, ReportTotals } from '@/types';

type Props = {
    client: ClientDetails;
    projects: {
        id: number;
        name: string;
        code: string | null;
        color: string;
        isArchived: boolean;
    }[];
    /** Time on the client's projects in the chosen period. */
    report: {
        period: string;
        from: string;
        to: string;
        periods: SelectOption[];
        totals: ReportTotals;
        projects: (ReportTotals & {
            id: number;
            name: string;
            color: string | null;
        })[];
    };
    currency: string;
    /** Null when the viewer may not create projects. */
    projectForm: ProjectFormOptions | null;
};

export default function ClientShow({
    client,
    projects,
    report,
    currency,
    projectForm,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const [isEditOpen, setEditOpen] = useState(false);
    const [isProjectOpen, setProjectOpen] = useState(false);

    const toggleArchived = () =>
        router.visit(
            client.isArchived
                ? restore({ client: client.id })
                : archive({ client: client.id }),
            { preserveScroll: true },
        );

    return (
        <>
            <Head title={client.name} />

            <div className="grid gap-8">
                <Heading
                    title={
                        <span className="flex items-center gap-3">
                            <LogoImage
                                src={client.logo}
                                name={client.name}
                                size={40}
                            />
                            {client.name}
                            {client.isArchived && (
                                <Chip size="sm" variant="soft">
                                    {t('Archived')}
                                </Chip>
                            )}
                        </span>
                    }
                    description={[client.organizationNumber, client.email]
                        .filter(Boolean)
                        .join(' · ')}
                    actions={
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                onPress={() => setEditOpen(true)}
                                data-test="edit-client-button"
                            >
                                <Pencil className="size-4" />
                                {t('Edit')}
                            </Button>
                            <Button
                                variant="tertiary"
                                onPress={toggleArchived}
                                data-test="archive-client-button"
                            >
                                {client.isArchived ? (
                                    <ArchiveRestore className="size-4" />
                                ) : (
                                    <Archive className="size-4" />
                                )}
                                {client.isArchived
                                    ? t('Restore')
                                    : t('Archive')}
                            </Button>
                        </div>
                    }
                />

                {client.notes && (
                    <p className="text-sm whitespace-pre-line">
                        {client.notes}
                    </p>
                )}

                <section className="grid gap-4" data-test="client-report">
                    <Heading
                        variant="small"
                        title={t('Reported time')}
                        actions={
                            <SelectField
                                name="period"
                                label={
                                    <span className="sr-only">
                                        {t('Period')}
                                    </span>
                                }
                                options={report.periods.filter(
                                    (option) => option.value !== 'custom',
                                )}
                                value={report.period}
                                onChange={(period) =>
                                    router.get(
                                        window.location.pathname,
                                        { period },
                                        {
                                            preserveScroll: true,
                                            preserveState: true,
                                            replace: true,
                                        },
                                    )
                                }
                                className="w-44"
                            />
                        }
                    />

                    <ReportStats totals={report.totals} currency={currency} />

                    {report.projects.length > 0 && (
                        <ul className="divide-y divide-separator rounded-2xl bg-surface text-sm shadow-surface">
                            {report.projects.map((project) => (
                                <li
                                    key={project.id}
                                    className="flex items-center justify-between gap-3 px-4 py-3"
                                >
                                    <span className="flex items-center gap-2">
                                        {project.color && (
                                            <ProjectDot color={project.color} />
                                        )}
                                        {project.name}
                                    </span>
                                    <span className="tabular-nums">
                                        {formatDecimalHours(
                                            project.seconds,
                                            intlLocale,
                                        )}
                                        {project.amount !== null && (
                                            <span className="ml-3 text-muted">
                                                {formatMoney(
                                                    project.amount,
                                                    currency,
                                                    intlLocale,
                                                )}
                                            </span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <Link
                        href={reportSummary(undefined, {
                            query: {
                                period: report.period,
                                clients: [client.id],
                                group: 'project',
                                subgroup: 'member',
                            },
                        })}
                        className="text-sm text-accent"
                    >
                        {t('Open in reports')}
                    </Link>
                </section>

                <section className="grid gap-4">
                    <Heading
                        variant="small"
                        title={t('Projects')}
                        actions={
                            projectForm && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onPress={() => setProjectOpen(true)}
                                    data-test="new-client-project-button"
                                >
                                    <Plus className="size-4" />
                                    {t('New project')}
                                </Button>
                            )
                        }
                    />
                    <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface shadow-surface">
                        {projects.map((project) => (
                            <li key={project.id}>
                                <Link
                                    href={showProject({ project: project.id })}
                                    className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-secondary"
                                >
                                    <ProjectDot color={project.color} />
                                    <span className="min-w-0 flex-1 truncate font-medium">
                                        {project.name}
                                        {project.code && (
                                            <span className="ml-2 text-sm font-normal text-muted">
                                                {project.code}
                                            </span>
                                        )}
                                    </span>
                                    {project.isArchived && (
                                        <Chip size="sm" variant="soft">
                                            {t('Archived')}
                                        </Chip>
                                    )}
                                    <ChevronRight className="size-4 text-muted" />
                                </Link>
                            </li>
                        ))}
                        {projects.length === 0 && (
                            <li className="p-8 text-center text-sm text-muted">
                                {t('No projects for this client yet.')}
                            </li>
                        )}
                    </ul>
                </section>
            </div>

            <ClientFormDrawer
                client={client}
                isOpen={isEditOpen}
                onOpenChange={setEditOpen}
            />

            {projectForm && (
                <ProjectFormDrawer
                    project={null}
                    defaultClientId={client.id}
                    options={projectForm}
                    isOpen={isProjectOpen}
                    onOpenChange={setProjectOpen}
                />
            )}
        </>
    );
}

ClientShow.layout = {
    breadcrumbs: [
        { title: 'Clients', href: index() },
        { title: 'Client', href: '#' },
    ],
};
