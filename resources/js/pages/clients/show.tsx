import { Button, Chip } from '@heroui/react';
import { Head, Link, router } from '@inertiajs/react';
import { Archive, ArchiveRestore, ChevronRight, Pencil } from 'lucide-react';
import { useState } from 'react';
import { ClientFormModal } from '@/components/client-form-modal';
import Heading from '@/components/heading';
import { ProjectDot } from '@/components/project-dot';
import { useTranslation } from '@/lib/i18n';
import { archive, index, restore } from '@/routes/clients';
import {
    create as createProject,
    show as showProject,
} from '@/routes/projects';
import type { ClientDetails } from '@/types';

type Props = {
    client: ClientDetails;
    projects: {
        id: number;
        name: string;
        code: string | null;
        color: string;
        isArchived: boolean;
    }[];
};

export default function ClientShow({ client, projects }: Props) {
    const { t } = useTranslation();
    const [isEditOpen, setEditOpen] = useState(false);

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
                        <span className="flex items-center gap-2">
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

                <section className="grid gap-4">
                    <Heading
                        variant="small"
                        title={t('Projects')}
                        actions={
                            <Link
                                href={createProject(undefined, {
                                    query: { client: client.id },
                                })}
                                className="text-sm font-medium text-accent"
                            >
                                {t('New project')}
                            </Link>
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
                    <p className="text-xs text-muted">
                        {t(
                            'Reported time per client arrives with time reporting.',
                        )}
                    </p>
                </section>
            </div>

            <ClientFormModal
                client={client}
                isOpen={isEditOpen}
                onOpenChange={setEditOpen}
            />
        </>
    );
}

ClientShow.layout = {
    breadcrumbs: [
        { title: 'Clients', href: index() },
        { title: 'Client', href: '#' },
    ],
};
