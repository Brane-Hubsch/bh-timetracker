import { Button, Chip } from '@heroui/react';
import { Head, usePage } from '@inertiajs/react';
import { Pencil, UserPlus, Users } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Fragment, useState } from 'react';
import { SelectField } from '@/components/form/select-field';
import Heading from '@/components/heading';
import InviteMemberModal from '@/components/invite-member-modal';
import { ListFilters } from '@/components/list-filters';
import {
    MobileListFilters,
    mobileFilterSegmentsClass,
} from '@/components/mobile-list-filters';
import { MobileListHeader } from '@/components/mobile-list-header';
import {
    ColumnOrderStatus,
    ReorderableColumnHeader,
    columnOrderHeaderClassName,
    useColumnOrder,
} from '@/components/reorderable-column-header';
import { SegmentedControl } from '@/components/segmented-control';
import { MemberAvatar } from '@/components/team/member-avatar';
import { MemberDrawer } from '@/components/team/member-drawer';
import { useIsDesktop } from '@/hooks/use-media-query';
import {
    defaultSearchStatus,
    useMobileListFilters,
    type SearchStatusFilters,
} from '@/hooks/use-mobile-list-filters';
import { useOpenFromQuery } from '@/hooks/use-open-from-query';
import { formatMoney } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { index } from '@/routes/team';
import type { RoleOption, TeamMember, TeamOrganization } from '@/types';

type Props = {
    organization: TeamOrganization;
    members: TeamMember[];
    canViewRates: boolean;
    canInvite: boolean;
    roles: RoleOption[];
    filters: SearchStatusFilters & { role: string | null };
};

const defaultFilters: Props['filters'] = { ...defaultSearchStatus, role: null };
const defaultColumnOrder = ['Email address', 'Role', 'Hourly rate'] as const;
const noticeIconClass =
    'grid size-[52px] place-items-center rounded-full bg-default text-muted';

const columnWidths = {
    'Email address': 'minmax(0,1.2fr)',
    Role: 'minmax(5rem,0.65fr)',
    'Hourly rate': '8rem',
};

export default function TeamIndex({
    organization,
    members,
    canViewRates,
    canInvite,
    roles,
    filters,
}: Props) {
    const { t, tc, intlLocale } = useTranslation();
    const { auth, timer } = usePage().props;
    const isDesktop = useIsDesktop();
    const [isInviteOpen, setInviteOpen] = useState(false);
    const { current, search, isOpen, changeOpen, apply, changeSearch } =
        useMobileListFilters(
            index.url(organization.slug),
            filters,
            defaultFilters,
        );
    const deactivatedLabel = t('Deactivated (plural)');
    const filterLabels = [
        current.status === 'archived' ? deactivatedLabel : null,
        roles.find(({ value }) => value === current.role)?.label,
        current.search ? `“${current.search}”` : null,
    ].filter((label): label is string => Boolean(label));
    const clearFilters = () => apply(defaultFilters);
    const showSoloHint =
        canInvite &&
        members.length === 1 &&
        members[0].id === auth.user.id &&
        filters.status === 'active' &&
        filters.role === null &&
        !filters.search &&
        filterLabels.length === 0;
    const [selection, setSelection] = useState<{
        id: number;
        isOpen: boolean;
        formKey: number;
    } | null>(null);
    const editing = members.find(
        (member) => member.id === selection?.id && member.canEdit,
    );
    const openMember = (id: number) =>
        setSelection((previous) => ({
            id,
            isOpen: true,
            formKey: (previous?.formKey ?? 0) + 1,
        }));
    const showActions = members.some((member) => member.canEdit);
    const order = useColumnOrder({
        storageKey: `timereport:team-column-order:${auth.user.id}`,
        defaultOrder: defaultColumnOrder,
        isVisible: (column) => canViewRates || column !== 'Hourly rate',
    });
    const columns = [
        'minmax(0,1fr)',
        ...order.columns.map((column) => columnWidths[column]),
        showActions ? '3rem' : '',
    ].join(' ');

    useOpenFromQuery('invite', () => setInviteOpen(canInvite));

    return (
        <>
            <Head title={t('Team')} />
            <div
                className={cn(
                    'flex flex-col md:grid md:gap-6',
                    timer
                        ? 'max-md:min-h-[calc(100svh-var(--mobile-tab-bar-height)-var(--mobile-timer-space))]'
                        : 'max-md:min-h-[calc(100svh-var(--mobile-tab-bar-height))]',
                )}
            >
                {isDesktop ? (
                    <>
                        <Heading
                            title={t('Team')}
                            actions={
                                canInvite && (
                                    <Button
                                        onPress={() => setInviteOpen(true)}
                                        data-test="team-invite"
                                    >
                                        <UserPlus className="size-4" />
                                        {t('Invite')}
                                    </Button>
                                )
                            }
                        />
                        <ListFilters
                            filters={filters}
                            searchLabel={t('Search by name or email')}
                            archivedLabel={deactivatedLabel}
                        >
                            {(apply) => (
                                <SelectField
                                    name="role"
                                    label={
                                        <span className="sr-only">
                                            {t('Role')}
                                        </span>
                                    }
                                    value={filters.role ?? 'all'}
                                    onChange={(role) =>
                                        apply({
                                            role: role === 'all' ? null : role,
                                        })
                                    }
                                    options={[
                                        { value: 'all', label: t('All roles') },
                                        ...roles,
                                    ]}
                                    className="w-full gap-0 sm:w-44"
                                    triggerClassName="h-9 items-center py-0"
                                />
                            )}
                        </ListFilters>
                    </>
                ) : (
                    <MobileListHeader
                        title={t('Team')}
                        filterLabels={filterLabels}
                        filtersOpen={isOpen}
                        onOpenFilters={() => changeOpen(true)}
                        filterTestId="mobile-team-filters"
                        createAction={
                            canInvite
                                ? {
                                      icon: UserPlus,
                                      label: t('Invite member'),
                                      onPress: () => setInviteOpen(true),
                                      testId: 'mobile-team-invite',
                                  }
                                : undefined
                        }
                    />
                )}
                <div
                    className="max-md:flex max-md:flex-1 max-md:flex-col md:overflow-hidden md:rounded-2xl md:bg-surface md:shadow-surface"
                    style={{ '--team-columns': columns } as CSSProperties}
                >
                    {isDesktop && (
                        <ColumnOrderStatus announcement={order.announcement} />
                    )}
                    {isDesktop && members.length > 0 && (
                        <div
                            className={`${columnOrderHeaderClassName} hidden items-center gap-x-6 border-b border-separator px-5 py-2.5 text-sm font-medium text-muted xl:grid xl:grid-cols-(--team-columns)`}
                        >
                            <span>{t('Name')}</span>
                            {order.columns.map((column) => (
                                <ReorderableColumnHeader
                                    key={column}
                                    order={order}
                                    column={column}
                                    label={t(column)}
                                />
                            ))}
                        </div>
                    )}
                    <ul className="md:divide-y md:divide-separator">
                        {members.map((member) => {
                            const cells = {
                                'Email address': (
                                    <p
                                        className="truncate text-muted max-md:text-[13px]/[18px]"
                                        title={member.email}
                                    >
                                        {member.email}
                                    </p>
                                ),
                                Role: (
                                    <span>
                                        <Chip
                                            className="px-2 max-md:h-5"
                                            size="sm"
                                            variant="soft"
                                            color={
                                                member.role === 'member'
                                                    ? 'default'
                                                    : 'accent'
                                            }
                                        >
                                            {member.roleLabel}
                                        </Chip>
                                    </span>
                                ),
                                'Hourly rate': canViewRates && (
                                    <span
                                        className="text-xs text-muted tabular-nums max-md:text-[13px]/[18px] xl:text-sm"
                                        data-test="team-hourly-rate"
                                    >
                                        {member.hourlyRate == null
                                            ? t('Default')
                                            : t(':amount/h', {
                                                  amount: formatMoney(
                                                      member.hourlyRate,
                                                      organization.currency,
                                                      intlLocale,
                                                  ),
                                              })}
                                    </span>
                                ),
                            };
                            const name = (
                                <p
                                    className="truncate font-medium max-md:text-[15px]/5"
                                    title={member.name}
                                >
                                    {member.name}
                                    {member.id === auth.user.id && (
                                        <span className="text-muted">
                                            {' '}
                                            ({t('you')})
                                        </span>
                                    )}
                                </p>
                            );
                            const editButton = member.canEdit && (
                                <Button
                                    isIconOnly
                                    variant="ghost"
                                    size="sm"
                                    aria-label={t('Edit :name', {
                                        name: member.name,
                                    })}
                                    onPress={() => openMember(member.id)}
                                    data-test="edit-team-member"
                                    className="max-md:relative max-md:size-[34px] max-md:min-w-0 max-md:shrink-0 max-md:overflow-visible max-md:p-0 max-md:before:absolute max-md:before:-inset-[5px] max-md:before:content-['']"
                                >
                                    <Pencil className="size-4" />
                                </Button>
                            );

                            if (!isDesktop) {
                                return (
                                    <li
                                        key={member.id}
                                        className={cn(
                                            "relative flex items-center gap-3 px-4 py-3 not-last:after:pointer-events-none not-last:after:absolute not-last:after:inset-s-[68px] not-last:after:inset-e-0 not-last:after:bottom-0 not-last:after:border-b not-last:after:border-separator not-last:after:content-['']",
                                            member.canEdit && 'pr-2',
                                        )}
                                        data-test="team-member-row"
                                    >
                                        <MemberAvatar
                                            name={member.name}
                                            avatar={member.avatar}
                                            className="size-10"
                                        />
                                        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5">
                                            {name}
                                            <div className="flex justify-self-end leading-none">
                                                {cells.Role}
                                            </div>
                                            {cells['Email address']}
                                            <div className="justify-self-end text-[13px]/[18px] whitespace-nowrap">
                                                {cells['Hourly rate']}
                                            </div>
                                        </div>
                                        {editButton}
                                    </li>
                                );
                            }

                            return (
                                <li
                                    key={member.id}
                                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 p-4 text-sm xl:grid-cols-(--team-columns) xl:items-center xl:gap-x-6 xl:px-5 xl:py-2.5"
                                    data-test="team-member-row"
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <MemberAvatar
                                            name={member.name}
                                            avatar={member.avatar}
                                        />
                                        <div className="min-w-0">
                                            {name}
                                            <p className="truncate text-xs text-muted xl:hidden">
                                                {member.email}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="hidden xl:contents">
                                        {order.columns.map((column) => (
                                            <Fragment key={column}>
                                                {cells[column]}
                                            </Fragment>
                                        ))}
                                    </div>
                                    <div className="col-start-1 row-start-2 ml-12 flex items-center gap-2 xl:hidden">
                                        {cells.Role}
                                        {cells['Hourly rate']}
                                    </div>
                                    {showActions && (
                                        <div className="col-start-2 row-span-2 row-start-1 flex items-center justify-end xl:col-auto xl:row-auto">
                                            {editButton}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    {isDesktop && members.length === 0 && (
                        <p className="px-5 py-8 text-center text-sm text-muted">
                            {t('No members found.')}
                        </p>
                    )}
                    {!isDesktop &&
                        members.length === 0 &&
                        filterLabels.length > 0 && (
                            <div className="grid flex-1 place-content-center justify-items-center px-4 py-10 text-center">
                                <span className={noticeIconClass}>
                                    <Users
                                        aria-hidden="true"
                                        className="size-6"
                                    />
                                </span>
                                <p className="mt-4 text-[15px] font-medium">
                                    {t('No members found.')}
                                </p>
                                <Button
                                    variant="ghost"
                                    className="text-accent"
                                    onPress={clearFilters}
                                >
                                    {t('Clear filters')}
                                </Button>
                            </div>
                        )}
                    {showSoloHint && (
                        <div className="grid justify-items-center px-4 pt-12 text-center md:border-t md:border-separator md:py-10">
                            <span className={noticeIconClass}>
                                <UserPlus
                                    aria-hidden="true"
                                    className="size-6"
                                />
                            </span>
                            <p className="mt-3 text-[15px] font-medium">
                                {t('Only you so far.')}
                            </p>
                            <p className="mt-1 text-[13px]/[18px] text-muted max-md:max-w-60 md:text-sm">
                                {t(
                                    'Invite colleagues so they can report time here.',
                                )}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {!isDesktop && (
                <MobileListFilters
                    isOpen={isOpen}
                    onOpenChange={changeOpen}
                    hasFilters={filterLabels.length > 0}
                    onClear={clearFilters}
                    searchLabel={t('Search by name or email')}
                    search={search}
                    onSearchChange={changeSearch}
                    status={current.status}
                    archivedLabel={deactivatedLabel}
                    onStatusChange={(status) => apply({ status })}
                    doneLabel={tc(
                        'Show :count member|Show :count members',
                        members.length,
                    )}
                >
                    <div className="grid gap-1.5">
                        <span className="text-[13px] text-muted">
                            {t('Role')}
                        </span>
                        <SegmentedControl
                            aria-label={t('Role')}
                            className={mobileFilterSegmentsClass}
                            value={current.role ?? 'all'}
                            onChange={(role) =>
                                apply({ role: role === 'all' ? null : role })
                            }
                            options={[
                                { id: 'all', label: t('All') },
                                ...roles.map(({ value, label }) => ({
                                    id: value,
                                    label,
                                })),
                            ]}
                        />
                    </div>
                </MobileListFilters>
            )}

            {canInvite && (
                <InviteMemberModal
                    organization={organization}
                    availableRoles={roles.filter(
                        (role) => role.value !== 'owner',
                    )}
                    fromTeam
                    isOpen={isInviteOpen}
                    onOpenChange={setInviteOpen}
                />
            )}
            {selection && editing?.schedule && (
                <MemberDrawer
                    key={selection.formKey}
                    isOpen={selection.isOpen}
                    member={{ ...editing, schedule: editing.schedule }}
                    organization={organization}
                    roles={roles}
                    canViewRates={canViewRates}
                    isSelf={editing.id === auth.user.id}
                    onClose={() =>
                        setSelection((current) =>
                            current?.formKey === selection.formKey
                                ? { ...current, isOpen: false }
                                : current,
                        )
                    }
                />
            )}
        </>
    );
}
