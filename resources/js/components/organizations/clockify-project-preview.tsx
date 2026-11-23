import { Alert, Button, Chip, Label, Switch } from '@heroui/react';
import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import Heading from '@/components/heading';
import { formatDecimalHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { destroy, run } from '@/routes/organizations/import';
import type { ProjectImportPreview } from '@/types';

type Props = {
    slug: string;
    preview: ProjectImportPreview;
};

/**
 * Preview of Clockify's project export: new projects with their status, visibility, note,
 * estimate and members (billable is chosen here), and what changes on existing projects.
 */
export function ClockifyProjectPreview({ slug, preview }: Props) {
    const { t, tc, intlLocale } = useTranslation();
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [billable, setBillable] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(
            preview.projects.map((project) => [project.key, project.billable]),
        ),
    );
    const [isImporting, setImporting] = useState(false);
    const params = { organization: slug, import: preview.token };
    const count = preview.newCount + preview.changedCount;
    const changeLabels: Record<
        ProjectImportPreview['projects'][number]['changes'][number],
        string
    > = {
        archive: t('Is archived'),
        private: t('Becomes private'),
        note: t('Gets the note'),
        estimate: t('Gets the estimate'),
        members: t('Gets members'),
    };
    const groups: {
        client: string | null;
        projects: ProjectImportPreview['projects'];
    }[] = [];

    for (const project of preview.projects) {
        const group = groups.find(
            (candidate) => candidate.client === project.client,
        );

        if (group) {
            group.projects.push(project);
        } else {
            groups.push({ client: project.client, projects: [project] });
        }
    }

    const runImport = () =>
        router.post(
            run.url(params),
            {
                projects: preview.projects
                    .filter((project) => project.isNew)
                    .map((project) => ({
                        key: project.key,
                        billable: billable[project.key] ?? true,
                    })),
            },
            {
                onStart: () => setImporting(true),
                onFinish: () => setImporting(false),
            },
        );

    return (
        <div
            className="grid grid-cols-1 gap-8"
            data-test="import-project-preview"
        >
            <section className="grid gap-3">
                <Heading
                    variant="small"
                    title={t('Projects from Clockify')}
                    description={t(
                        "Projects are matched on client and name. New projects get Clockify's status, visibility, note, estimate and members. Existing projects are archived or made private when they are in Clockify, and get the note and estimate when they have none. Nothing is restored or overwritten.",
                    )}
                />
                <p className="text-sm text-muted">
                    {t(
                        ':new new projects and :changed changed. Import the time afterwards: it can be put on archived projects too.',
                        {
                            new: preview.newCount,
                            changed: preview.changedCount,
                        },
                    )}
                </p>
                {preview.unknownMembers.length > 0 && (
                    <p
                        className="text-sm text-muted"
                        data-test="import-project-unknown-members"
                    >
                        {t(
                            'Not members, so not assigned: :names. Invite them first if they should be.',
                            { names: preview.unknownMembers.join(', ') },
                        )}
                    </p>
                )}
            </section>

            {groups.map((group) => (
                <section
                    key={group.client ?? ''}
                    className="grid gap-2"
                    data-test="import-client"
                >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
                        <h3 className="font-semibold">
                            {group.client ?? t('No client')}
                        </h3>
                        {group.client !== null &&
                            preview.newClients.includes(group.client) && (
                                <Chip size="sm" color="accent" variant="soft">
                                    {t('New client')}
                                </Chip>
                            )}
                    </div>
                    <ul className="grid gap-2">
                        {group.projects.map((project) => (
                            <li
                                key={project.key}
                                className="grid gap-2 rounded-2xl bg-surface p-4 shadow-surface"
                                data-test="import-project"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="flex flex-wrap items-center gap-2">
                                            <span className="truncate font-medium">
                                                {project.name}
                                            </span>
                                            {project.isNew ? (
                                                <Chip
                                                    size="sm"
                                                    color="accent"
                                                    variant="soft"
                                                >
                                                    {t('New')}
                                                </Chip>
                                            ) : project.changes.length > 0 ? (
                                                <Chip
                                                    size="sm"
                                                    color="warning"
                                                    variant="soft"
                                                >
                                                    {t('Changes')}
                                                </Chip>
                                            ) : (
                                                <Chip size="sm" variant="soft">
                                                    {t('Unchanged')}
                                                </Chip>
                                            )}
                                        </p>
                                        <p className="text-sm text-muted">
                                            {[
                                                project.archived
                                                    ? t('Archived')
                                                    : null,
                                                project.private
                                                    ? t('Private')
                                                    : null,
                                                project.estimateSeconds !== null
                                                    ? t('Estimate :hours', {
                                                          hours: formatDecimalHours(
                                                              project.estimateSeconds,
                                                              intlLocale,
                                                          ),
                                                      })
                                                    : null,
                                                project.members.join(', ') ||
                                                    null,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                    </div>
                                    {project.isNew && (
                                        <Switch
                                            isSelected={
                                                billable[project.key] ?? true
                                            }
                                            onChange={(selected) =>
                                                setBillable((current) => ({
                                                    ...current,
                                                    [project.key]: selected,
                                                }))
                                            }
                                            data-test="import-project-billable"
                                        >
                                            <Switch.Content>
                                                <Switch.Control>
                                                    <Switch.Thumb />
                                                </Switch.Control>
                                                <Label className="text-sm">
                                                    {t('Billable')}
                                                </Label>
                                            </Switch.Content>
                                        </Switch>
                                    )}
                                </div>
                                {!project.isNew &&
                                    project.changes.length > 0 && (
                                        <p className="text-sm">
                                            {project.changes
                                                .map(
                                                    (change) =>
                                                        changeLabels[change],
                                                )
                                                .join(' · ')}
                                        </p>
                                    )}
                                {project.note && (
                                    <p className="line-clamp-2 text-sm wrap-anywhere text-muted">
                                        {project.note}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}

            {errors.import && (
                <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Description>{errors.import}</Alert.Description>
                    </Alert.Content>
                </Alert>
            )}

            <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap justify-end gap-2 border-t border-separator bg-background/90 px-4 py-3 backdrop-blur md:bottom-4 md:mx-0 md:rounded-2xl md:border md:shadow-surface">
                <Button
                    variant="tertiary"
                    onPress={() => router.delete(destroy.url(params))}
                    data-test="import-cancel"
                >
                    {t('Cancel')}
                </Button>
                <Button
                    onPress={runImport}
                    isPending={isImporting}
                    isDisabled={count === 0}
                    data-test="import-run"
                >
                    {tc('Import :count project|Import :count projects', count, {
                        count,
                    })}
                </Button>
            </div>
        </div>
    );
}
