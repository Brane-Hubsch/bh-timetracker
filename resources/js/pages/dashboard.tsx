import { Button, Modal } from '@heroui/react';
import { Head, Link, usePage } from '@inertiajs/react';
import { Clock, Plus } from 'lucide-react';
import { useState } from 'react';
import { EstimateProgress } from '@/components/estimate-progress';
import Heading from '@/components/heading';
import { PendingInvitationList } from '@/components/pending-invitation-list';
import { ProjectDot } from '@/components/project-dot';
import { newDraft } from '@/components/time/drafts';
import {
    TimeEntryForm,
    draftFromEntry,
} from '@/components/time/time-entry-form';
import { useTranslation } from '@/lib/i18n';
import { formatDate, formatDuration, timeOf } from '@/lib/time';
import { dashboard } from '@/routes';
import { show as showProject } from '@/routes/projects';
import { index as timeIndex } from '@/routes/time';
import type {
    DashboardInvitation,
    ProjectOption,
    TimeEntry,
    TimeEntryDraft,
    TimeEntryMemberOption,
} from '@/types';

type Props = {
    pendingInvitations?: DashboardInvitation[];
    today: string;
    todaySeconds: number;
    weekSeconds: number;
    recentEntries: TimeEntry[];
    projects: ProjectOption[];
    /** The organization's tag names. */
    tags: string[];
    recentTags: string[];
    members: TimeEntryMemberOption[];
    /** Recently used project ids per member id (owners and admins). */
    recentProjects: Record<string, string[]>;
    team: { id: number; name: string; seconds: number }[] | null;
    projectsNearEstimate:
        | {
              id: number;
              slug: string;
              name: string;
              color: string;
              consumedSeconds: number;
              estimateSeconds: number;
          }[]
        | null;
};

function Stat({ label, seconds }: { label: string; seconds: number }) {
    return (
        <div className="grid gap-1 rounded-2xl bg-surface p-4 shadow-surface">
            <span className="text-sm text-muted">{label}</span>
            <span className="text-3xl font-semibold tabular-nums">
                {formatDuration(seconds)}
            </span>
        </div>
    );
}

export default function Dashboard({
    pendingInvitations = [],
    today,
    todaySeconds,
    weekSeconds,
    recentEntries,
    projects,
    tags,
    recentTags,
    members,
    recentProjects,
    team,
    projectsNearEstimate,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const { auth } = usePage().props;
    const [showInvitations, setShowInvitations] = useState(
        pendingInvitations.length > 0,
    );
    const [draft, setDraft] = useState<TimeEntryDraft | null>(null);
    const todaysEntries = recentEntries.filter((entry) => entry.date === today);
    // Team and projects sit beside the recent entries on wide screens.
    const hasSidebar =
        team !== null ||
        (projectsNearEstimate !== null && projectsNearEstimate.length > 0);

    return (
        <>
            <Head title={t('Today')} />

            <div className="grid gap-6">
                <Heading
                    title={t('Hi :name!', {
                        name: auth.user.name.split(' ')[0],
                    })}
                    description={formatDate(today, intlLocale, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                    })}
                    actions={
                        <Button
                            onPress={() =>
                                setDraft(
                                    newDraft(
                                        today,
                                        todaysEntries,
                                        auth.user.id,
                                    ),
                                )
                            }
                            data-test="quick-add"
                        >
                            <Plus className="size-4" />
                            {t('Report time')}
                        </Button>
                    }
                />

                <div className="grid grid-cols-2 gap-3">
                    <Stat label={t('Today')} seconds={todaySeconds} />
                    <Stat label={t('This week')} seconds={weekSeconds} />
                </div>

                <div
                    className={`grid items-start gap-6 ${hasSidebar ? 'xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''}`}
                >
                    <section className="grid gap-3">
                        <Heading
                            variant="small"
                            title={t('Recent entries')}
                            actions={
                                <Link
                                    href={timeIndex()}
                                    className="text-sm font-medium text-accent"
                                >
                                    {t('Show calendar')}
                                </Link>
                            }
                        />
                        <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface shadow-surface">
                            {recentEntries.map((entry) => (
                                <li key={entry.id}>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setDraft(draftFromEntry(entry))
                                        }
                                        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-secondary"
                                    >
                                        <ProjectDot
                                            color={entry.project.color}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate font-medium">
                                                {entry.project.name}
                                            </div>
                                            <div className="truncate text-sm text-muted">
                                                {entry.description ||
                                                    t('No description')}
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right text-sm tabular-nums">
                                            <div className="font-medium">
                                                {formatDuration(
                                                    entry.durationSeconds,
                                                )}
                                            </div>
                                            <div className="text-muted first-letter:uppercase">
                                                {entry.date === today
                                                    ? t('Today')
                                                    : formatDate(
                                                          entry.date,
                                                          intlLocale,
                                                      )}{' '}
                                                {timeOf(entry.start)}
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                            {recentEntries.length === 0 && (
                                <li className="grid justify-items-center gap-2 p-10 text-center">
                                    <Clock className="size-8 text-muted" />
                                    <p className="font-medium">
                                        {t('No time reported yet')}
                                    </p>
                                    <p className="text-sm text-muted">
                                        {t(
                                            'Report your first hours with the button above.',
                                        )}
                                    </p>
                                </li>
                            )}
                        </ul>
                    </section>

                    {hasSidebar && (
                        <div className="grid content-start gap-6">
                            {team && (
                                <section className="grid gap-3">
                                    <Heading
                                        variant="small"
                                        title={t('Team this week')}
                                    />
                                    <ul className="divide-y divide-separator rounded-2xl bg-surface shadow-surface">
                                        {team.map((member) => (
                                            <li
                                                key={member.id}
                                                className="flex items-center justify-between p-4 text-sm"
                                            >
                                                <Link
                                                    href={timeIndex(undefined, {
                                                        query: {
                                                            user: member.id,
                                                        },
                                                    })}
                                                    className="font-medium"
                                                >
                                                    {member.name}
                                                </Link>
                                                <span className="tabular-nums">
                                                    {formatDuration(
                                                        member.seconds,
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            {projectsNearEstimate &&
                                projectsNearEstimate.length > 0 && (
                                    <section className="grid gap-3">
                                        <Heading
                                            variant="small"
                                            title={t(
                                                'Projects close to their estimate',
                                            )}
                                        />
                                        <ul className="divide-y divide-separator rounded-2xl bg-surface shadow-surface">
                                            {projectsNearEstimate.map(
                                                (project) => (
                                                    <li
                                                        key={project.id}
                                                        className="grid gap-2 p-4"
                                                    >
                                                        <Link
                                                            href={showProject({
                                                                project:
                                                                    project.slug,
                                                            })}
                                                            className="flex items-center gap-2 font-medium"
                                                        >
                                                            <ProjectDot
                                                                color={
                                                                    project.color
                                                                }
                                                            />
                                                            {project.name}
                                                        </Link>
                                                        <EstimateProgress
                                                            consumedSeconds={
                                                                project.consumedSeconds
                                                            }
                                                            estimateSeconds={
                                                                project.estimateSeconds
                                                            }
                                                        />
                                                    </li>
                                                ),
                                            )}
                                        </ul>
                                    </section>
                                )}
                        </div>
                    )}
                </div>
            </div>

            <TimeEntryForm
                draft={draft}
                onClose={() => setDraft(null)}
                projects={projects}
                tags={tags}
                recentTags={recentTags}
                members={members}
                recentProjects={recentProjects}
            />

            <Modal.Backdrop
                isOpen={pendingInvitations.length > 0 && showInvitations}
                onOpenChange={setShowInvitations}
            >
                <Modal.Container>
                    <Modal.Dialog
                        className="sm:max-w-md"
                        data-test="pending-invitations-modal"
                    >
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>
                                {t('Pending invitations')}
                            </Modal.Heading>
                        </Modal.Header>
                        <Modal.Body>
                            <PendingInvitationList
                                invitations={pendingInvitations}
                                onDeclined={() =>
                                    pendingInvitations.length === 1 &&
                                    setShowInvitations(false)
                                }
                            />
                        </Modal.Body>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </>
    );
}

Dashboard.layout = (props: {
    currentOrganization?: { slug: string } | null;
}) => ({
    breadcrumbs: props.currentOrganization
        ? [{ title: 'Today', href: dashboard(props.currentOrganization.slug) }]
        : [],
});
