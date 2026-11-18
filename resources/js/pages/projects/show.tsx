import {
    Avatar,
    Button,
    Chip,
    Label,
    NumberField,
    buttonVariants,
} from '@heroui/react';
import { Head, Link, router } from '@inertiajs/react';
import { Archive, ArchiveRestore, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import type { SelectOption } from '@/components/form/select-field';
import { SelectField } from '@/components/form/select-field';
import Heading from '@/components/heading';
import { EstimateProgress } from '@/components/estimate-progress';
import { ProjectDot } from '@/components/project-dot';
import { RateField } from '@/components/rate-field';
import { useInitials } from '@/hooks/use-initials';
import { formatHours, formatMoney, toMinorUnits } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { show as showClient } from '@/routes/clients';
import { archive, edit, index, restore } from '@/routes/projects';
import {
    destroy as unassignMember,
    store as assignMember,
    update as updateMemberRate,
} from '@/routes/projects/members';
import type { ProjectDetails, ProjectMemberItem } from '@/types';

type Props = {
    project: ProjectDetails;
    members: ProjectMemberItem[];
    assignableMembers: SelectOption[];
    currency: string;
    abilities: { manage: boolean; viewRates: boolean };
};

function Detail({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid gap-1">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-sm font-medium">{children}</dd>
        </div>
    );
}

export default function ProjectShow({
    project,
    members,
    assignableMembers,
    currency,
    abilities: can,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const getInitials = useInitials();
    const [newMemberId, setNewMemberId] = useState('');
    const [newMemberRate, setNewMemberRate] = useState(Number.NaN);

    const money = (minor: number | null) =>
        minor === null
            ? t('Default')
            : `${formatMoney(minor, currency, intlLocale)}/h`;

    const addMember = () => {
        router.visit(assignMember({ project: project.id }), {
            data: {
                user_id: Number(newMemberId),
                hourly_rate: Number.isNaN(newMemberRate)
                    ? null
                    : toMinorUnits(newMemberRate),
            },
            preserveScroll: true,
            onSuccess: () => {
                setNewMemberId('');
                setNewMemberRate(Number.NaN);
            },
        });
    };

    const setRate = (member: ProjectMemberItem, rate: number | null) => {
        router.visit(
            updateMemberRate({ project: project.id, user: member.id }),
            {
                data: { hourly_rate: rate },
                preserveScroll: true,
            },
        );
    };

    return (
        <>
            <Head title={project.name} />

            <div className="grid gap-8">
                <Heading
                    title={
                        <span className="flex items-center gap-2">
                            <ProjectDot color={project.color} />
                            {project.name}
                            {project.isArchived && (
                                <Chip size="sm" variant="soft">
                                    {t('Archived')}
                                </Chip>
                            )}
                        </span>
                    }
                    description={project.code ?? undefined}
                    actions={
                        can.manage && (
                            <div className="flex gap-2">
                                <Link
                                    href={edit({ project: project.id })}
                                    className={buttonVariants({
                                        variant: 'secondary',
                                    })}
                                    data-test="edit-project-button"
                                >
                                    <Pencil className="size-4" />
                                    {t('Edit')}
                                </Link>
                                <Button
                                    variant="tertiary"
                                    onPress={() =>
                                        router.visit(
                                            project.isArchived
                                                ? restore({
                                                      project: project.id,
                                                  })
                                                : archive({
                                                      project: project.id,
                                                  }),
                                            { preserveScroll: true },
                                        )
                                    }
                                    data-test="archive-project-button"
                                >
                                    {project.isArchived ? (
                                        <ArchiveRestore className="size-4" />
                                    ) : (
                                        <Archive className="size-4" />
                                    )}
                                    {project.isArchived
                                        ? t('Restore')
                                        : t('Archive')}
                                </Button>
                            </div>
                        )
                    }
                />

                <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-surface p-4 shadow-surface sm:grid-cols-3 sm:p-6">
                    <Detail label={t('Client')}>
                        {project.client ? (
                            can.manage ? (
                                <Link
                                    href={showClient({
                                        client: project.client.id,
                                    })}
                                    className="text-accent"
                                >
                                    {project.client.name}
                                </Link>
                            ) : (
                                project.client.name
                            )
                        ) : (
                            t('No client')
                        )}
                    </Detail>
                    <Detail label={t('Billable')}>
                        {project.isBillable ? t('Yes') : t('No')}
                    </Detail>
                    {can.viewRates && (
                        <Detail label={t('Hourly rate')}>
                            {money(project.hourlyRate)}
                        </Detail>
                    )}
                    <Detail label={t('Estimate')}>
                        {project.estimateSeconds === null
                            ? '–'
                            : formatHours(project.estimateSeconds, intlLocale)}
                    </Detail>
                    <Detail label={t('Visibility')}>
                        {project.isPrivate ? t('Private') : t('Public')}
                    </Detail>
                    {(project.startsOn || project.endsOn) && (
                        <Detail label={t('Period')}>
                            {[project.startsOn, project.endsOn]
                                .map((d) => d ?? '…')
                                .join(' – ')}
                        </Detail>
                    )}
                </dl>

                <section className="grid gap-3 rounded-2xl bg-surface p-4 shadow-surface sm:p-6">
                    <h2 className="text-sm font-medium">
                        {t('Reported time')}
                    </h2>
                    {project.estimateSeconds !== null ? (
                        <EstimateProgress
                            consumedSeconds={project.consumedSeconds}
                            estimateSeconds={project.estimateSeconds}
                        />
                    ) : (
                        <p className="text-2xl font-semibold tabular-nums">
                            {formatHours(project.consumedSeconds, intlLocale)}
                        </p>
                    )}
                    <p className="text-xs text-muted">
                        {t(
                            'Time per member and week and billable amounts arrive with reports.',
                        )}
                    </p>
                </section>

                <section className="grid gap-4">
                    <Heading
                        variant="small"
                        title={t('Project members')}
                        description={
                            project.isPrivate
                                ? t(
                                      'Only these members can see the project and report time on it.',
                                  )
                                : t(
                                      'Everyone can report time. Assign members to set a project rate.',
                                  )
                        }
                    />

                    <ul className="divide-y divide-separator rounded-2xl bg-surface shadow-surface">
                        {members.map((member) => (
                            <li
                                key={member.id}
                                className="flex flex-wrap items-center justify-between gap-3 p-4"
                                data-test="project-member-row"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <Avatar size="sm">
                                        {member.avatar && (
                                            <Avatar.Image
                                                src={member.avatar}
                                                alt={member.name}
                                            />
                                        )}
                                        <Avatar.Fallback>
                                            {getInitials(member.name)}
                                        </Avatar.Fallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <div className="truncate font-medium">
                                            {member.name}
                                        </div>
                                        <div className="truncate text-sm text-muted">
                                            {member.email}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {can.manage && can.viewRates ? (
                                        <RateField
                                            aria-label={t(
                                                'Project rate for :name',
                                                {
                                                    name: member.name,
                                                },
                                            )}
                                            rate={member.hourlyRate}
                                            onSave={(rate) =>
                                                setRate(member, rate)
                                            }
                                        />
                                    ) : (
                                        can.viewRates && (
                                            <span className="text-sm text-muted">
                                                {money(member.hourlyRate)}
                                            </span>
                                        )
                                    )}
                                    {can.manage && (
                                        <Button
                                            isIconOnly
                                            variant="ghost"
                                            size="sm"
                                            aria-label={t(
                                                'Remove from project',
                                            )}
                                            onPress={() =>
                                                router.visit(
                                                    unassignMember({
                                                        project: project.id,
                                                        user: member.id,
                                                    }),
                                                    { preserveScroll: true },
                                                )
                                            }
                                            data-test="unassign-member-button"
                                        >
                                            <X className="size-4" />
                                        </Button>
                                    )}
                                </div>
                            </li>
                        ))}
                        {members.length === 0 && (
                            <li className="p-6 text-center text-sm text-muted">
                                {t('No members assigned.')}
                            </li>
                        )}
                    </ul>

                    {can.manage && assignableMembers.length > 0 && (
                        <div className="flex flex-col gap-3 rounded-2xl bg-surface-secondary p-4 sm:flex-row sm:items-end">
                            <SelectField
                                name="user_id"
                                label={t('Add member')}
                                placeholder={t('Choose a member')}
                                value={newMemberId}
                                onChange={setNewMemberId}
                                options={assignableMembers}
                                className="w-full sm:w-64"
                                data-test="assign-member-select"
                            />
                            {can.viewRates && (
                                <NumberField
                                    value={newMemberRate}
                                    onChange={setNewMemberRate}
                                    minValue={0}
                                    formatOptions={{ maximumFractionDigits: 2 }}
                                    className="w-full sm:w-40"
                                >
                                    <Label>
                                        {t('Project rate')} ({currency}/h)
                                    </Label>
                                    <NumberField.Group>
                                        <NumberField.Input
                                            placeholder={t('Default')}
                                        />
                                    </NumberField.Group>
                                </NumberField>
                            )}
                            <Button
                                variant="secondary"
                                isDisabled={newMemberId === ''}
                                onPress={addMember}
                                data-test="assign-member-button"
                            >
                                {t('Add')}
                            </Button>
                        </div>
                    )}
                </section>
            </div>
        </>
    );
}

ProjectShow.layout = {
    breadcrumbs: [
        { title: 'Projects', href: index() },
        { title: 'Project', href: '#' },
    ],
};
