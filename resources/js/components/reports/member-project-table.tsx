import { Avatar, Button, Table, Tooltip } from '@heroui/react';
import { usePage } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { ProjectDot } from '@/components/project-dot';
import { BreakdownTooltip } from '@/components/reports/breakdown-tooltip';
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
    const [activeTooltip, setActiveTooltip] = useState<{
        key: string;
        source: 'hover' | 'focus';
    } | null>(null);
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
                            const canExpand = projects.length > 0;
                            const expanded =
                                canExpand && expandedMembers.has(member.key);
                            const detailsId = `${tableId}-projects-${member.key}`;
                            const avatar =
                                avatars.get(member.key) ??
                                (member.key === String(auth.user.id)
                                    ? auth.user.avatar
                                    : null);

                            const row = (
                                <Table.Row
                                    key={member.key}
                                    id={member.key}
                                    className="[&>.table__cell]:py-2!"
                                    onPointerEnter={(event) => {
                                        if (
                                            canExpand &&
                                            event.pointerType === 'mouse'
                                        ) {
                                            setActiveTooltip((current) =>
                                                current?.key === member.key &&
                                                current.source === 'focus'
                                                    ? current
                                                    : {
                                                          key: member.key,
                                                          source: 'hover',
                                                      },
                                            );
                                        }
                                    }}
                                    onPointerLeave={(event) => {
                                        if (event.pointerType === 'mouse') {
                                            setActiveTooltip((current) =>
                                                current?.key === member.key &&
                                                current.source === 'hover'
                                                    ? null
                                                    : current,
                                            );
                                        }
                                    }}
                                >
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
                                    <Table.Cell className="relative">
                                        <ProjectPreview
                                            name={member.label}
                                            projects={projects}
                                            maxSeconds={maxSeconds}
                                            isOpen={
                                                activeTooltip?.key ===
                                                member.key
                                            }
                                            onOpenChange={(isOpen) =>
                                                setActiveTooltip((current) =>
                                                    isOpen
                                                        ? {
                                                              key: member.key,
                                                              source: 'focus',
                                                          }
                                                        : current?.key ===
                                                            member.key
                                                          ? null
                                                          : current,
                                                )
                                            }
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
    name,
    projects,
    maxSeconds,
    isOpen,
    onOpenChange,
}: {
    name: string;
    projects: ReportGroup[];
    maxSeconds: number;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}) {
    const { t } = useTranslation();
    const remaining =
        maxSeconds -
        projects.reduce((total, project) => total + project.seconds, 0);

    if (projects.length === 0) {
        return (
            <div aria-hidden="true" className="h-2 rounded-full bg-default" />
        );
    }

    const items = projects.map((project) => ({
        ...project,
        color: project.color ?? 'var(--muted)',
    }));

    return (
        <Tooltip
            trigger="focus"
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            closeDelay={0}
        >
            <Tooltip.Trigger
                role="group"
                tabIndex={0}
                aria-label={t('Project breakdown')}
                className="absolute inset-x-4 inset-y-0 grid content-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
                <div
                    className="flex h-2 gap-px overflow-hidden rounded-full"
                    aria-hidden="true"
                >
                    {items.map(({ key, color, seconds }) => (
                        <span
                            key={key}
                            className="min-w-0 basis-0"
                            style={{
                                flexGrow: seconds,
                                backgroundColor: color,
                            }}
                        />
                    ))}
                    {remaining > 0 && (
                        <span
                            className="min-w-0 basis-0 bg-default"
                            style={{ flexGrow: remaining }}
                        />
                    )}
                </div>
            </Tooltip.Trigger>
            <BreakdownTooltip title={name} items={items} placement="bottom" />
        </Tooltip>
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
