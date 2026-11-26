import {
    Avatar,
    Button,
    Chip,
    Description,
    ComboBox,
    Dropdown,
    Input,
    Label,
    ListBox,
    NumberField,
    Separator,
    Switch,
    buttonVariants,
} from '@heroui/react';
import { Form, Head, Link, router, usePage } from '@inertiajs/react';
import { EllipsisVertical, FileUp, Mail, UserPlus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import DeleteOrganizationModal from '@/components/delete-organization-modal';
import { ImageUploadField } from '@/components/form/image-upload-field';
import { SelectField } from '@/components/form/select-field';
import { TextInputField } from '@/components/form/text-input-field';
import Heading from '@/components/heading';
import { HolidayManager } from '@/components/organizations/holiday-manager';
import type { OrganizationHoliday } from '@/components/organizations/holiday-manager';
import InviteMemberModal from '@/components/invite-member-modal';
import { RateField } from '@/components/rate-field';
import { useInitials } from '@/hooks/use-initials';
import { useOpenFromQuery } from '@/hooks/use-open-from-query';
import { useOverlayData } from '@/hooks/use-overlay-data';
import { useTranslation } from '@/lib/i18n';
import { index, update } from '@/routes/organizations';
import { create as createImport } from '@/routes/organizations/import';
import {
    destroy as destroyLogo,
    update as updateLogo,
} from '@/routes/organizations/logo';
import { destroy as destroyInvitation } from '@/routes/organizations/invitations';
import {
    deactivate as deactivateMember,
    destroy as destroyMember,
    rate as updateMemberRate,
    reactivate as reactivateMember,
    update as updateMember,
} from '@/routes/organizations/members';
import type {
    OrganizationInvitation,
    OrganizationMember,
    OrganizationPermissions,
    OrganizationSettings,
    RoleOption,
} from '@/types';

type Props = {
    organization: OrganizationSettings;
    members: OrganizationMember[];
    invitations: OrganizationInvitation[];
    permissions: OrganizationPermissions;
    availableRoles: RoleOption[];
    /** From this year on; for owners and admins only. */
    holidays: OrganizationHoliday[] | null;
    holidayYears: number[];
};

const currencies = ['SEK', 'EUR', 'NOK', 'DKK', 'USD', 'GBP'];

export default function OrganizationEdit({
    organization,
    members,
    invitations,
    permissions,
    availableRoles,
    holidays,
    holidayYears,
}: Props) {
    const { t } = useTranslation();
    const getInitials = useInitials();
    const [isInviteOpen, setInviteOpen] = useState(false);
    const [timerEnabled, setTimerEnabled] = useState(organization.timerEnabled);
    useOpenFromQuery('invite', () =>
        setInviteOpen(permissions.canCreateInvitation),
    );
    const [isDeleteOpen, setDeleteOpen] = useState(false);
    const [memberToRemove, setMemberToRemove] =
        useState<OrganizationMember | null>(null);
    const [invitationToCancel, setInvitationToCancel] =
        useState<OrganizationInvitation | null>(null);
    const removeTarget = useOverlayData(memberToRemove);
    const cancelTarget = useOverlayData(invitationToCancel);
    const [isProcessing, setProcessing] = useState(false);
    const [isUploadingLogo, setUploadingLogo] = useState(false);
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const logoVisit = {
        preserveScroll: true,
        onStart: () => setUploadingLogo(true),
        onFinish: () => setUploadingLogo(false),
    };

    const timezones = useMemo(() => Intl.supportedValuesOf('timeZone'), []);

    const visitAndClose = (
        url: Parameters<typeof router.visit>[0],
        close: () => void,
    ) => {
        router.visit(url, {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => {
                setProcessing(false);
                close();
            },
        });
    };

    const changeRole = (member: OrganizationMember, role: string) => {
        router.visit(updateMember([organization.slug, member.id]), {
            data: { role },
            preserveScroll: true,
        });
    };

    return (
        <>
            <Head title={organization.name} />

            {permissions.canUpdateOrganization ? (
                <section className="grid gap-6">
                    <Heading
                        variant="small"
                        title={t('Organization settings')}
                        description={t(
                            'Name, currency and defaults for time reporting.',
                        )}
                    />

                    <Form
                        {...update.form(organization.slug)}
                        options={{ preserveScroll: true }}
                        transform={(data) => ({
                            ...data,
                            // Entered in major units (kronor), stored in minor units (öre).
                            default_hourly_rate:
                                data.default_hourly_rate === '' ||
                                data.default_hourly_rate === undefined
                                    ? null
                                    : Math.round(
                                          Number(data.default_hourly_rate) *
                                              100,
                                      ),
                        })}
                        className="grid gap-4"
                    >
                        {({ errors, processing }) => (
                            <>
                                <TextInputField
                                    name="name"
                                    label={t('Organization name')}
                                    defaultValue={organization.name}
                                    error={errors.name}
                                    isRequired
                                    data-test="organization-name-input"
                                />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <SelectField
                                        name="currency"
                                        label={t('Currency')}
                                        defaultValue={organization.currency}
                                        options={currencies.map((code) => ({
                                            value: code,
                                            label: code,
                                        }))}
                                        error={errors.currency}
                                    />
                                    <NumberField
                                        name="default_hourly_rate"
                                        defaultValue={
                                            organization.defaultHourlyRate ===
                                            null
                                                ? undefined
                                                : organization.defaultHourlyRate /
                                                  100
                                        }
                                        minValue={0}
                                        formatOptions={{
                                            maximumFractionDigits: 2,
                                        }}
                                        isInvalid={Boolean(
                                            errors.default_hourly_rate,
                                        )}
                                        validationBehavior="aria"
                                        className="w-full"
                                    >
                                        <Label>
                                            {t('Default hourly rate')} (
                                            {organization.currency}/h)
                                        </Label>
                                        <NumberField.Group>
                                            <NumberField.Input />
                                        </NumberField.Group>
                                        {errors.default_hourly_rate && (
                                            <p className="text-sm text-danger">
                                                {errors.default_hourly_rate}
                                            </p>
                                        )}
                                    </NumberField>
                                    <NumberField
                                        name="workday_hours"
                                        defaultValue={organization.workdayHours}
                                        minValue={1}
                                        maxValue={24}
                                        step={0.5}
                                        formatOptions={{
                                            maximumFractionDigits: 2,
                                        }}
                                        isInvalid={Boolean(
                                            errors.workday_hours,
                                        )}
                                        validationBehavior="aria"
                                        className="w-full"
                                        data-test="organization-workday-hours"
                                    >
                                        <Label>
                                            {t('Workday length (hours)')}
                                        </Label>
                                        <NumberField.Group>
                                            <NumberField.Input />
                                        </NumberField.Group>
                                        {errors.workday_hours ? (
                                            <p className="text-sm text-danger">
                                                {errors.workday_hours}
                                            </p>
                                        ) : (
                                            <Description>
                                                {t(
                                                    'A full day of absence counts as this many hours.',
                                                )}
                                            </Description>
                                        )}
                                    </NumberField>
                                    <SelectField
                                        name="week_starts_on"
                                        label={t('Week starts on')}
                                        defaultValue={String(
                                            organization.weekStartsOn,
                                        )}
                                        options={[
                                            { value: '1', label: t('Monday') },
                                            { value: '7', label: t('Sunday') },
                                        ]}
                                        error={errors.week_starts_on}
                                    />
                                    <ComboBox
                                        name="timezone"
                                        defaultSelectedKey={
                                            organization.timezone
                                        }
                                        isInvalid={Boolean(errors.timezone)}
                                        validationBehavior="aria"
                                        className="w-full"
                                    >
                                        <Label>{t('Time zone')}</Label>
                                        <ComboBox.InputGroup>
                                            <Input />
                                            <ComboBox.Trigger />
                                        </ComboBox.InputGroup>
                                        {errors.timezone && (
                                            <p className="text-sm text-danger">
                                                {errors.timezone}
                                            </p>
                                        )}
                                        <ComboBox.Popover>
                                            <ListBox>
                                                {timezones.map((timezone) => (
                                                    <ListBox.Item
                                                        key={timezone}
                                                        id={timezone}
                                                        textValue={timezone}
                                                    >
                                                        <Label>
                                                            {timezone}
                                                        </Label>
                                                        <ListBox.ItemIndicator />
                                                    </ListBox.Item>
                                                ))}
                                            </ListBox>
                                        </ComboBox.Popover>
                                    </ComboBox>
                                </div>
                                {/* A switch sends nothing when off, so the value goes in a hidden field. */}
                                <input
                                    type="hidden"
                                    name="timer_enabled"
                                    value={timerEnabled ? '1' : '0'}
                                />
                                <Switch
                                    isSelected={timerEnabled}
                                    onChange={setTimerEnabled}
                                    className="items-start"
                                    data-test="organization-timer-enabled"
                                >
                                    <Switch.Content className="items-start">
                                        <Switch.Control className="mt-0.5">
                                            <Switch.Thumb />
                                        </Switch.Control>
                                        <span className="grid gap-0.5">
                                            <Label>
                                                {t('Allow the timer')}
                                            </Label>
                                            <Description>
                                                {t(
                                                    'Members can start and stop a timer instead of filling in times afterwards.',
                                                )}
                                            </Description>
                                        </span>
                                    </Switch.Content>
                                </Switch>
                                <div>
                                    <Button
                                        type="submit"
                                        isPending={processing}
                                        data-test="organization-save-button"
                                    >
                                        {t('Save')}
                                    </Button>
                                </div>
                            </>
                        )}
                    </Form>
                </section>
            ) : (
                <Heading
                    variant="small"
                    title={organization.name}
                    description={t('You are a member of this organization.')}
                />
            )}

            {permissions.canUpdateOrganization && (
                <>
                    <Separator />
                    <section
                        className="grid gap-4"
                        data-test="organization-logo"
                    >
                        <Heading
                            variant="small"
                            title={t('Logo')}
                            description={t(
                                'Shown in the organization switcher and on PDF reports.',
                            )}
                        />
                        <ImageUploadField
                            label={t('Logo')}
                            shape="square"
                            fit="cover"
                            src={organization.logo}
                            name={organization.name}
                            canRemove={organization.logo !== null}
                            onSelect={(image) =>
                                router.post(
                                    updateLogo.url(organization.slug),
                                    { image },
                                    {
                                        ...logoVisit,
                                        forceFormData: true,
                                    },
                                )
                            }
                            onRemove={() =>
                                router.delete(
                                    destroyLogo.url(organization.slug),
                                    logoVisit,
                                )
                            }
                            isPending={isUploadingLogo}
                            error={errors.image}
                        />
                    </section>
                </>
            )}

            <Separator />

            <section className="grid gap-4">
                <Heading
                    variant="small"
                    title={t('Members')}
                    description={t('People who can report time here.')}
                    actions={
                        permissions.canCreateInvitation && (
                            <Button
                                variant="secondary"
                                onPress={() => setInviteOpen(true)}
                                data-test="invite-member-button"
                            >
                                <UserPlus className="size-4" />
                                {t('Invite')}
                            </Button>
                        )
                    }
                />

                <ul className="divide-y divide-separator rounded-2xl bg-surface shadow-surface">
                    {members.map((member) => (
                        <li
                            key={member.id}
                            data-test="member-row"
                            className="flex flex-wrap items-center justify-between gap-3 p-4"
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
                                    <div className="flex items-center gap-2 truncate font-medium">
                                        {member.name}
                                        {member.is_deactivated && (
                                            <Chip
                                                size="sm"
                                                variant="soft"
                                                color="warning"
                                            >
                                                {t('Deactivated')}
                                            </Chip>
                                        )}
                                    </div>
                                    <div className="truncate text-sm text-muted">
                                        {member.email}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {member.role !== 'owner' &&
                                permissions.canUpdateMember ? (
                                    <SelectField
                                        name={`role-${member.id}`}
                                        label={
                                            <span className="sr-only">
                                                {t('Role')}
                                            </span>
                                        }
                                        value={member.role}
                                        onChange={(role) =>
                                            changeRole(member, role)
                                        }
                                        options={availableRoles}
                                        className="w-36"
                                        data-test="member-role-trigger"
                                    />
                                ) : (
                                    <span className="text-sm text-muted">
                                        {member.role_label}
                                    </span>
                                )}
                                {permissions.canViewRates &&
                                    permissions.canUpdateMember && (
                                        <RateField
                                            aria-label={t(
                                                'Hourly rate for :name',
                                                {
                                                    name: member.name,
                                                },
                                            )}
                                            rate={member.hourly_rate}
                                            onSave={(rate) =>
                                                router.visit(
                                                    updateMemberRate([
                                                        organization.slug,
                                                        member.id,
                                                    ]),
                                                    {
                                                        data: {
                                                            hourly_rate: rate,
                                                        },
                                                        preserveScroll: true,
                                                    },
                                                )
                                            }
                                            className="w-28"
                                        />
                                    )}
                                {member.role !== 'owner' &&
                                    (permissions.canUpdateMember ||
                                        permissions.canRemoveMember) && (
                                        <Dropdown>
                                            <Button
                                                isIconOnly
                                                variant="ghost"
                                                size="sm"
                                                aria-label={t('Member actions')}
                                                data-test="member-actions"
                                            >
                                                <EllipsisVertical className="size-4" />
                                            </Button>
                                            <Dropdown.Popover placement="bottom end">
                                                <Dropdown.Menu
                                                    onAction={(key) => {
                                                        if (key === 'remove') {
                                                            setMemberToRemove(
                                                                member,
                                                            );

                                                            return;
                                                        }

                                                        router.visit(
                                                            (key ===
                                                                'deactivate'
                                                                ? deactivateMember
                                                                : reactivateMember)(
                                                                [
                                                                    organization.slug,
                                                                    member.id,
                                                                ],
                                                            ),
                                                            {
                                                                preserveScroll: true,
                                                            },
                                                        );
                                                    }}
                                                >
                                                    {permissions.canUpdateMember ? (
                                                        <Dropdown.Item
                                                            id={
                                                                member.is_deactivated
                                                                    ? 'reactivate'
                                                                    : 'deactivate'
                                                            }
                                                            textValue={t(
                                                                'Deactivate',
                                                            )}
                                                        >
                                                            <Label>
                                                                {member.is_deactivated
                                                                    ? t(
                                                                          'Reactivate',
                                                                      )
                                                                    : t(
                                                                          'Deactivate',
                                                                      )}
                                                            </Label>
                                                        </Dropdown.Item>
                                                    ) : null}
                                                    {permissions.canRemoveMember ? (
                                                        <Dropdown.Item
                                                            id="remove"
                                                            textValue={t(
                                                                'Remove member',
                                                            )}
                                                            variant="danger"
                                                        >
                                                            <Label>
                                                                {t(
                                                                    'Remove member',
                                                                )}
                                                            </Label>
                                                        </Dropdown.Item>
                                                    ) : null}
                                                </Dropdown.Menu>
                                            </Dropdown.Popover>
                                        </Dropdown>
                                    )}
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            {invitations.length > 0 && (
                <section className="grid gap-4">
                    <Heading variant="small" title={t('Pending invitations')} />
                    <ul className="divide-y divide-separator rounded-2xl bg-surface shadow-surface">
                        {invitations.map((invitation) => (
                            <li
                                key={invitation.code}
                                data-test="invitation-row"
                                className="flex items-center justify-between gap-3 p-4"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <Mail className="size-4 shrink-0 text-muted" />
                                    <div className="min-w-0">
                                        <div className="truncate font-medium">
                                            {invitation.email}
                                        </div>
                                        <div className="text-sm text-muted">
                                            {invitation.role_label}
                                        </div>
                                    </div>
                                </div>
                                {permissions.canCancelInvitation && (
                                    <Button
                                        isIconOnly
                                        variant="ghost"
                                        size="sm"
                                        aria-label={t('Cancel invitation')}
                                        onPress={() =>
                                            setInvitationToCancel(invitation)
                                        }
                                        data-test="invitation-cancel-button"
                                    >
                                        <X className="size-4" />
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {holidays && (
                <>
                    <Separator />
                    <HolidayManager
                        organizationSlug={organization.slug}
                        holidays={holidays}
                        years={holidayYears}
                    />
                </>
            )}

            {permissions.canManageClients &&
                permissions.canManageProjects &&
                permissions.canManageTeamTime && (
                    <>
                        <Separator />
                        <section
                            className="grid gap-4"
                            data-test="import-section"
                        >
                            <Heading
                                variant="small"
                                title={t('Import')}
                                description={t(
                                    'Bring in time entries, clients and projects from a Clockify CSV export.',
                                )}
                            />
                            <div>
                                <Link
                                    href={createImport(organization.slug)}
                                    className={buttonVariants({
                                        variant: 'secondary',
                                    })}
                                >
                                    <FileUp className="size-4" />
                                    {t('Import from Clockify')}
                                </Link>
                            </div>
                        </section>
                    </>
                )}

            {permissions.canDeleteOrganization && (
                <>
                    <Separator />
                    <section className="grid gap-4 rounded-2xl border border-danger/30 p-4">
                        <Heading
                            variant="small"
                            title={t('Delete organization')}
                            description={t(
                                'Deletes the organization and all of its data for every member.',
                            )}
                        />
                        <div>
                            <Button
                                variant="danger-soft"
                                onPress={() => setDeleteOpen(true)}
                                data-test="delete-organization-button"
                            >
                                {t('Delete organization')}
                            </Button>
                        </div>
                    </section>
                    <DeleteOrganizationModal
                        organization={organization}
                        isOpen={isDeleteOpen}
                        onOpenChange={setDeleteOpen}
                    />
                </>
            )}

            {permissions.canCreateInvitation && (
                <InviteMemberModal
                    organization={organization}
                    availableRoles={availableRoles}
                    isOpen={isInviteOpen}
                    onOpenChange={setInviteOpen}
                />
            )}

            <ConfirmDialog
                isOpen={memberToRemove !== null}
                onOpenChange={(isOpen) => !isOpen && setMemberToRemove(null)}
                title={t('Remove member')}
                confirmLabel={t('Remove member')}
                isPending={isProcessing}
                onConfirm={() =>
                    memberToRemove &&
                    visitAndClose(
                        destroyMember([organization.slug, memberToRemove.id]),
                        () => setMemberToRemove(null),
                    )
                }
                data-test="remove-member-confirm"
            >
                <p className="text-sm">
                    {t(':name will lose access to this organization.', {
                        name: removeTarget?.name ?? '',
                    })}
                </p>
            </ConfirmDialog>

            <ConfirmDialog
                isOpen={invitationToCancel !== null}
                onOpenChange={(isOpen) =>
                    !isOpen && setInvitationToCancel(null)
                }
                title={t('Cancel invitation')}
                confirmLabel={t('Cancel invitation')}
                isPending={isProcessing}
                onConfirm={() =>
                    invitationToCancel &&
                    visitAndClose(
                        destroyInvitation([
                            organization.slug,
                            invitationToCancel.code,
                        ]),
                        () => setInvitationToCancel(null),
                    )
                }
                data-test="cancel-invitation-confirm"
            >
                <p className="text-sm">
                    {t('The invitation to :email will no longer work.', {
                        email: cancelTarget?.email ?? '',
                    })}
                </p>
            </ConfirmDialog>
        </>
    );
}

OrganizationEdit.layout = {
    breadcrumbs: [
        {
            title: 'Organizations',
            href: index(),
        },
    ],
};
