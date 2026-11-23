import { Button, Chip } from '@heroui/react';
import { Head, usePage } from '@inertiajs/react';
import { Pencil, UserPlus } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { SelectField } from '@/components/form/select-field';
import Heading from '@/components/heading';
import InviteMemberModal from '@/components/invite-member-modal';
import { ListFilters } from '@/components/list-filters';
import { MemberAvatar } from '@/components/team/member-avatar';
import { MemberDrawer } from '@/components/team/member-drawer';
import { useOpenFromQuery } from '@/hooks/use-open-from-query';
import { formatMoney } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { RoleOption, TeamMember, TeamOrganization } from '@/types';

type Props = {
    organization: TeamOrganization;
    members: TeamMember[];
    canViewRates: boolean;
    canInvite: boolean;
    roles: RoleOption[];
    filters: {
        search: string;
        role: string | null;
        status: 'active' | 'archived';
    };
};

export default function TeamIndex({
    organization,
    members,
    canViewRates,
    canInvite,
    roles,
    filters,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const { auth } = usePage().props;
    const [isInviteOpen, setInviteOpen] = useState(false);
    const [memberId, setMemberId] = useState<number | null>(null);
    const editing = members.find(
        (member) => member.id === memberId && member.canEdit,
    );
    const showActions = members.some((member) => member.canEdit);
    const columns = [
        'minmax(0,1fr) minmax(0,1.2fr) minmax(5rem,0.65fr)',
        canViewRates ? '8rem' : '',
        showActions ? '3rem' : '',
    ].join(' ');

    useOpenFromQuery('invite', () => setInviteOpen(canInvite));

    return (
        <>
            <Head title={t('Team')} />
            <div className="grid gap-6">
                <Heading
                    title={t('Team')}
                    actions={
                        canInvite && (
                            <Button
                                onPress={() => setInviteOpen(true)}
                                data-test="team-invite"
                            >
                                <UserPlus className="size-4" />
                                {t('Invite member')}
                            </Button>
                        )
                    }
                />
                <ListFilters
                    filters={filters}
                    searchLabel={t('Search by name or email')}
                    archivedLabel={t('Deactivated (plural)')}
                >
                    {(apply) => (
                        <SelectField
                            name="role"
                            label={<span className="sr-only">{t('Role')}</span>}
                            value={filters.role ?? 'all'}
                            onChange={(role) =>
                                apply({ role: role === 'all' ? null : role })
                            }
                            options={[
                                { value: 'all', label: t('All roles') },
                                ...roles,
                            ]}
                            className="w-full sm:w-44"
                        />
                    )}
                </ListFilters>
                <div
                    className="overflow-hidden rounded-2xl bg-surface shadow-surface"
                    style={{ '--team-columns': columns } as CSSProperties}
                >
                    {members.length > 0 && (
                        <div
                            aria-hidden="true"
                            className="hidden gap-4 border-b border-separator px-5 py-2.5 text-xs font-medium text-muted xl:grid xl:grid-cols-(--team-columns)"
                        >
                            <span>{t('Name')}</span>
                            <span>{t('Email address')}</span>
                            <span>{t('Role')}</span>
                            {canViewRates && (
                                <span className="text-right">
                                    {t('Hourly rate')}
                                </span>
                            )}
                        </div>
                    )}
                    <ul className="divide-y divide-separator">
                        {members.map((member) => (
                            <li
                                key={member.id}
                                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 p-4 text-sm xl:grid-cols-(--team-columns) xl:items-center xl:px-5 xl:py-2.5"
                                data-test="team-member-row"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <MemberAvatar
                                        name={member.name}
                                        avatar={member.avatar}
                                    />
                                    <div className="min-w-0">
                                        <p
                                            className="truncate font-medium"
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
                                        <p className="truncate text-xs text-muted xl:hidden">
                                            {member.email}
                                        </p>
                                    </div>
                                </div>
                                <p
                                    className="hidden truncate text-muted xl:block"
                                    title={member.email}
                                >
                                    {member.email}
                                </p>
                                <div className="col-start-1 row-start-2 ml-12 flex items-center gap-2 xl:contents">
                                    <span>
                                        <Chip
                                            className="px-2"
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
                                    {canViewRates && (
                                        <span
                                            className="text-xs text-muted tabular-nums xl:text-right xl:text-sm"
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
                                    )}
                                </div>
                                {showActions && (
                                    <div className="col-start-2 row-span-2 row-start-1 flex items-center justify-end xl:col-auto xl:row-auto">
                                        {member.canEdit && (
                                            <Button
                                                isIconOnly
                                                variant="ghost"
                                                size="sm"
                                                aria-label={t('Edit :name', {
                                                    name: member.name,
                                                })}
                                                onPress={() =>
                                                    setMemberId(member.id)
                                                }
                                                data-test="edit-team-member"
                                            >
                                                <Pencil className="size-4" />
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                    {members.length === 0 && (
                        <p className="px-5 py-8 text-center text-sm text-muted">
                            {t('No members found.')}
                        </p>
                    )}
                </div>
            </div>

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
            {editing?.schedule && (
                <MemberDrawer
                    key={editing.id}
                    member={{ ...editing, schedule: editing.schedule }}
                    organization={organization}
                    roles={roles}
                    canViewRates={canViewRates}
                    isSelf={editing.id === auth.user.id}
                    onClose={() => setMemberId(null)}
                />
            )}
        </>
    );
}
