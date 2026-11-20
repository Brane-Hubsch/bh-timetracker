import { Avatar, Button, Table } from '@heroui/react';
import { usePage } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { ProjectDot } from '@/components/project-dot';
import { useInitials } from '@/hooks/use-initials';
import { formatDecimalHours, formatMoney } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { ReportGroup, ReportMemberOption } from '@/types';

type Props = {
    groups: ReportGroup[];
    members: ReportMemberOption[];
    showAmounts: boolean;
    currency: string;
};

export function MemberProjectTable({
    groups,
    members,
    showAmounts,
    currency,
}: Props) {
    const { auth } = usePage().props;
    const { t, intlLocale } = useTranslation();
    const getInitials = useInitials();
    const tableId = useId();
    const [expandedMembers, setExpandedMembers] = useState<Set<string>>(
        () => new Set(),
    );
    const avatars = new Map(
        members.map((member) => [member.value, member.avatar]),
    );
    const maxSeconds = groups.reduce(
        (largest, member) => Math.max(largest, member.seconds),
        1,
    );
    const hours = (seconds: number) => formatDecimalHours(seconds, intlLocale);

    function toggleMember(key: string) {
        setExpandedMembers((current) => {
            const next = new Set(current);
            if (!next.delete(key)) next.add(key);
            return next;
        });
    }

    return (
        <Table>
            <Table.ScrollContainer>
                <Table.Content
                    aria-label={t('Time per member and project')}
                    className={`table-fixed ${showAmounts ? 'min-w-[760px]' : 'min-w-[632px]'}`}
                    data-test="report-member-project-table"
                >
                    <Table.Header>
                        <Table.Column isRowHeader className="w-40 lg:w-[18%]">
                            {t('Member')}
                        </Table.Column>
                        <Table.Column className="w-24 text-right">
                            {t('Total')}
                        </Table.Column>
                        <Table.Column>{t('Project breakdown')}</Table.Column>
                        <Table.Column className="w-28 text-right">
                            {t('Billable')}
                        </Table.Column>
                        {showAmounts ? (
                            <Table.Column className="w-32 text-right">
                                {t('Amount')}
                            </Table.Column>
                        ) : null}
                        <Table.Column
                            className="w-12"
                            aria-label={t('Projects')}
                        >
                            {''}
                        </Table.Column>
                    </Table.Header>
                    <Table.Body
                        renderEmptyState={() => (
                            <p className="p-6 text-center text-sm text-muted">
                                {t('No time in this period.')}
                            </p>
                        )}
                    >
                        {groups.flatMap((member) => {
                            const projects = member.children;
                            const canExpand = projects.length > 1;
                            const expanded =
                                canExpand && expandedMembers.has(member.key);
                            const detailsId = `${tableId}-projects-${member.key}`;
                            const avatar =
                                avatars.get(member.key) ??
                                (member.key === String(auth.user.id)
                                    ? auth.user.avatar
                                    : null);

                            const row = (
                                <Table.Row key={member.key} id={member.key}>
                                    <Table.Cell>
                                        <span className="flex items-center gap-2 font-medium">
                                            <Avatar
                                                size="sm"
                                                variant="soft"
                                                color="accent"
                                                className="size-8 shrink-0 rounded-full"
                                                aria-hidden="true"
                                            >
                                                {avatar && (
                                                    <Avatar.Image
                                                        src={avatar}
                                                        alt=""
                                                        className="object-cover"
                                                    />
                                                )}
                                                <Avatar.Fallback>
                                                    {getInitials(member.label)}
                                                </Avatar.Fallback>
                                            </Avatar>
                                            <span className="min-w-0 wrap-break-word">
                                                {member.label}
                                            </span>
                                        </span>
                                    </Table.Cell>
                                    <Table.Cell className="text-right font-semibold whitespace-nowrap tabular-nums">
                                        {hours(member.seconds)}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <ProjectPreview
                                            projects={projects}
                                            maxSeconds={maxSeconds}
                                        />
                                    </Table.Cell>
                                    <Table.Cell className="text-right whitespace-nowrap tabular-nums">
                                        {hours(member.billableSeconds)}
                                    </Table.Cell>
                                    {showAmounts ? (
                                        <Table.Cell className="text-right whitespace-nowrap tabular-nums">
                                            {member.amount !== null &&
                                                formatMoney(
                                                    member.amount,
                                                    currency,
                                                    intlLocale,
                                                )}
                                        </Table.Cell>
                                    ) : null}
                                    <Table.Cell className="px-2 py-0 text-center">
                                        {canExpand && (
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="ghost"
                                                aria-label={t(
                                                    expanded
                                                        ? 'Hide projects for :name'
                                                        : 'Show projects for :name',
                                                    { name: member.label },
                                                )}
                                                aria-expanded={expanded}
                                                aria-controls={
                                                    expanded
                                                        ? detailsId
                                                        : undefined
                                                }
                                                onPress={() =>
                                                    toggleMember(member.key)
                                                }
                                            >
                                                <ChevronDown
                                                    aria-hidden="true"
                                                    size={16}
                                                    className={
                                                        expanded
                                                            ? 'rotate-180'
                                                            : undefined
                                                    }
                                                />
                                            </Button>
                                        )}
                                    </Table.Cell>
                                </Table.Row>
                            );

                            return expanded
                                ? [
                                      row,
                                      <Table.Row key={detailsId} id={detailsId}>
                                          <Table.Cell
                                              colSpan={2}
                                              className="bg-surface-secondary"
                                          />
                                          <Table.Cell
                                              colSpan={showAmounts ? 4 : 3}
                                              className="bg-surface-secondary"
                                          >
                                              <ProjectHours
                                                  id={detailsId}
                                                  projects={projects}
                                              />
                                          </Table.Cell>
                                      </Table.Row>,
                                  ]
                                : [row];
                        })}
                    </Table.Body>
                </Table.Content>
            </Table.ScrollContainer>
        </Table>
    );
}

function ProjectPreview({
    projects,
    maxSeconds,
}: {
    projects: ReportGroup[];
    maxSeconds: number;
}) {
    const { tc } = useTranslation();
    const visibleProjects = 2;
    const remaining = projects.length - visibleProjects;

    return (
        <div className="grid gap-1">
            <div
                className="flex h-2 overflow-hidden rounded-full bg-default"
                aria-hidden="true"
            >
                {projects.map((project) => (
                    <span
                        key={project.key}
                        className="shrink-0"
                        style={{
                            width: `${(project.seconds / maxSeconds) * 100}%`,
                            backgroundColor: project.color ?? 'var(--muted)',
                        }}
                    />
                ))}
            </div>
            <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                {projects.slice(0, visibleProjects).map((project) => (
                    <li
                        key={project.key}
                        className="flex min-w-0 items-center gap-1.5"
                    >
                        <ProjectDot color={project.color ?? 'var(--muted)'} />
                        <span className="wrap-break-word">{project.label}</span>
                    </li>
                ))}
                {remaining > 0 && (
                    <li>{tc('+:count project|+:count projects', remaining)}</li>
                )}
            </ul>
        </div>
    );
}

function ProjectHours({
    id,
    projects,
}: {
    id: string;
    projects: ReportGroup[];
}) {
    const { intlLocale } = useTranslation();

    return (
        <ul id={id} className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
            {projects.map((project) => (
                <li key={project.key} className="flex items-baseline gap-2">
                    <ProjectDot color={project.color ?? 'var(--muted)'} />
                    <span className="min-w-0 font-medium wrap-break-word">
                        {project.label}
                    </span>
                    <span className="shrink-0 text-muted tabular-nums">
                        {formatDecimalHours(project.seconds, intlLocale)}
                    </span>
                </li>
            ))}
        </ul>
    );
}
