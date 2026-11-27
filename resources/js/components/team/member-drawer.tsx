import {
    Button,
    Chip,
    FieldError,
    Label,
    NumberField,
    Separator,
    ToggleButton,
    ToggleButtonGroup,
} from '@heroui/react';
import { router, useForm } from '@inertiajs/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { FileTrigger } from 'react-aria-components';
import { HapticButton } from '@/components/haptic-button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ACCEPTED_IMAGE_TYPES } from '@/components/form/image-upload-field';
import { SelectField } from '@/components/form/select-field';
import {
    SideDrawer,
    SideDrawerBody,
    SideDrawerFooter,
    sideDrawerFormClass,
} from '@/components/side-drawer';
import { MemberAvatar } from '@/components/team/member-avatar';
import { formatDecimalHours, toMinorUnits } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { deactivate, reactivate } from '@/routes/organizations/members';
import { update } from '@/routes/team';
import {
    destroy as deleteAvatar,
    update as uploadAvatar,
} from '@/routes/team/avatar';
import type {
    RoleOption,
    TeamMember,
    TeamOrganization,
    TeamSchedule,
} from '@/types';

const DAYS = [
    ['Monday', 'Mon'],
    ['Tuesday', 'Tue'],
    ['Wednesday', 'Wed'],
    ['Thursday', 'Thu'],
    ['Friday', 'Fri'],
    ['Saturday', 'Sat'],
    ['Sunday', 'Sun'],
] as const;

const footerButtonLayoutClassName = 'max-md:min-w-0 max-md:flex-1';
const footerButtonClassName =
    'max-md:min-w-0 max-md:px-1 max-md:leading-tight max-md:whitespace-normal';

type Props = {
    isOpen: boolean;
    member: TeamMember & { schedule: TeamSchedule };
    organization: TeamOrganization;
    roles: RoleOption[];
    canViewRates: boolean;
    isSelf: boolean;
    onClose: () => void;
};

export function MemberDrawer({
    isOpen,
    member,
    organization,
    roles,
    canViewRates,
    isSelf,
    onClose,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const [confirmDeactivate, setConfirmDeactivate] = useState(false);
    const [changingStatus, setChangingStatus] = useState(false);
    const [changingAvatar, setChangingAvatar] = useState(false);
    const [avatarError, setAvatarError] = useState<string>();
    const [focusedNumberField, setFocusedNumberField] = useState<
        'workday' | 'rate' | null
    >(null);
    const workdayInput = useRef<HTMLInputElement>(null);
    const rateInput = useRef<HTMLInputElement>(null);
    const isRateFocused = focusedNumberField === 'rate';
    const target = [organization.slug, member.id] as const;
    const canChangeRole = member.role !== 'owner' && !isSelf;
    const canDeactivate = canChangeRole;
    const { schedule } = member;
    const form = useForm({
        role: member.role,
        hourly_rate: member.hourlyRate == null ? null : member.hourlyRate / 100,
        week_starts_on: schedule.weekStartsOn,
        workday_hours: schedule.workdayHours,
        working_days: schedule.workingDays,
    });
    const weekdays = DAYS.map(([label, short], i) => ({
        value: String(i + 1),
        label: t(label),
        shortLabel: t(short),
    }));
    const weekday = (value: number) => weekdays[value - 1]?.label ?? '';

    const changeStatus = () => {
        router.visit(
            (member.isDeactivated ? reactivate : deactivate)([...target]),
            {
                preserveScroll: true,
                onStart: () => setChangingStatus(true),
                onSuccess: onClose,
                onFinish: () => setChangingStatus(false),
            },
        );
    };
    const avatarOptions = {
        preserveScroll: true,
        onStart: () => {
            setAvatarError(undefined);
            setChangingAvatar(true);
        },
        onError: (errors: Record<string, string>) =>
            setAvatarError(errors.image),
        onFinish: () => setChangingAvatar(false),
    };

    return (
        <>
            <SideDrawer
                isOpen={isOpen}
                onOpenChange={(open) => {
                    if (!open) onClose();
                }}
                title={
                    member.isDeactivated
                        ? t('Member details')
                        : t('Edit member')
                }
                headerActions={
                    canViewRates &&
                    !member.isDeactivated &&
                    focusedNumberField && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            isIconOnly
                            preventFocusOnPress
                            aria-label={t(isRateFocused ? 'Previous' : 'Next')}
                            className="hidden max-md:in-data-keyboard-open:inline-flex"
                            onPress={() =>
                                (isRateFocused
                                    ? workdayInput
                                    : rateInput
                                ).current?.focus({ preventScroll: true })
                            }
                        >
                            {isRateFocused ? (
                                <ChevronUp
                                    aria-hidden="true"
                                    className="size-4"
                                />
                            ) : (
                                <ChevronDown
                                    aria-hidden="true"
                                    className="size-4"
                                />
                            )}
                        </Button>
                    )
                }
                mobileClassName="[&_.drawer__footer]:gap-3"
            >
                <form
                    className={sideDrawerFormClass}
                    onSubmit={(event) => {
                        event.preventDefault();

                        if (member.isDeactivated) return;

                        form.transform(
                            ({ role, hourly_rate, ...schedule }) => ({
                                ...schedule,
                                ...(canChangeRole ? { role } : {}),
                                ...(canViewRates
                                    ? { hourly_rate: toMinorUnits(hourly_rate) }
                                    : {}),
                            }),
                        );
                        form.patch(update.url([...target]), {
                            preserveScroll: true,
                            onSuccess: onClose,
                        });
                    }}
                >
                    <SideDrawerBody>
                        <div className="grid gap-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <MemberAvatar
                                    name={member.name}
                                    avatar={member.avatar}
                                    large
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-semibold">
                                        {member.name}
                                    </p>
                                    <p className="truncate text-sm text-muted">
                                        {member.email}
                                    </p>
                                </div>
                                {member.isDeactivated ? (
                                    <Chip
                                        size="sm"
                                        variant="soft"
                                        className="px-2"
                                    >
                                        {t('Deactivated')}
                                    </Chip>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-1 max-md:basis-full">
                                        <FileTrigger
                                            acceptedFileTypes={
                                                ACCEPTED_IMAGE_TYPES
                                            }
                                            onSelect={(files) => {
                                                const image = files?.[0];
                                                if (image)
                                                    router.post(
                                                        uploadAvatar.url([
                                                            ...target,
                                                        ]),
                                                        { image },
                                                        avatarOptions,
                                                    );
                                            }}
                                        >
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                isPending={changingAvatar}
                                            >
                                                {member.avatar
                                                    ? t(
                                                          'Change profile picture',
                                                      )
                                                    : t('Add profile picture')}
                                            </Button>
                                        </FileTrigger>
                                        {member.hasTeamAvatar && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                isDisabled={changingAvatar}
                                                onPress={() =>
                                                    router.delete(
                                                        deleteAvatar.url([
                                                            ...target,
                                                        ]),
                                                        avatarOptions,
                                                    )
                                                }
                                            >
                                                {t('Remove')}
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                            {avatarError && (
                                <p role="alert" className="text-sm text-danger">
                                    {avatarError}
                                </p>
                            )}
                        </div>
                        <Separator />
                        {member.isDeactivated ? (
                            <>
                                <section className="grid gap-1">
                                    <h3 className="font-semibold">
                                        {t('Access')}
                                    </h3>
                                    <p className="text-sm text-muted">
                                        {t(
                                            'Reactivation gives this member access to :organization again.',
                                            { organization: organization.name },
                                        )}
                                    </p>
                                </section>
                                <Separator />
                                <section className="grid gap-3">
                                    <h3 className="font-semibold">
                                        {t('Work schedule')}
                                    </h3>
                                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                                        <div className="grid gap-1">
                                            <dt className="font-medium">
                                                {t('Week starts on')}
                                            </dt>
                                            <dd className="text-muted">
                                                {weekday(
                                                    schedule.weekStartsOn ??
                                                        organization.weekStartsOn,
                                                )}
                                            </dd>
                                        </div>
                                        <div className="grid gap-1">
                                            <dt className="font-medium">
                                                {t(
                                                    'Expected hours per workday',
                                                )}
                                            </dt>
                                            <dd className="text-muted">
                                                {formatDecimalHours(
                                                    (schedule.workdayHours ??
                                                        organization.workdayHours) *
                                                        3600,
                                                    intlLocale,
                                                )}
                                            </dd>
                                        </div>
                                        <div className="grid gap-1 sm:col-span-2">
                                            <dt className="font-medium">
                                                {t('Working days')}
                                            </dt>
                                            <dd className="text-muted">
                                                {schedule.workingDays
                                                    .map(weekday)
                                                    .join(', ') ||
                                                    t('No working days')}
                                            </dd>
                                        </div>
                                    </dl>
                                </section>
                            </>
                        ) : (
                            <>
                                <section className="grid gap-3">
                                    <div className="grid gap-1">
                                        <h3 className="font-semibold">
                                            {t('Work schedule')}
                                        </h3>
                                        <p className="text-sm text-muted">
                                            {t(
                                                'Applies to this member in :organization.',
                                                {
                                                    organization:
                                                        organization.name,
                                                },
                                            )}
                                        </p>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <SelectField
                                            name="week_starts_on"
                                            label={t('Week starts on')}
                                            value={String(
                                                form.data.week_starts_on ??
                                                    'default',
                                            )}
                                            onChange={(value) =>
                                                form.setData(
                                                    'week_starts_on',
                                                    value === 'default'
                                                        ? null
                                                        : Number(value),
                                                )
                                            }
                                            options={[
                                                {
                                                    value: 'default',
                                                    label: t('Default (:day)', {
                                                        day: weekday(
                                                            organization.weekStartsOn,
                                                        ),
                                                    }),
                                                },
                                                ...weekdays,
                                            ]}
                                            error={form.errors.week_starts_on}
                                        />
                                        <NumberField
                                            name="workday_hours"
                                            value={
                                                form.data.workday_hours ?? NaN
                                            }
                                            onChange={(hours) =>
                                                form.setData(
                                                    'workday_hours',
                                                    Number.isFinite(hours)
                                                        ? hours
                                                        : null,
                                                )
                                            }
                                            minValue={0}
                                            maxValue={24}
                                            step={0.01}
                                            formatOptions={{
                                                maximumFractionDigits: 2,
                                            }}
                                            isInvalid={Boolean(
                                                form.errors.workday_hours,
                                            )}
                                            validationBehavior="aria"
                                        >
                                            <Label>
                                                {t(
                                                    'Expected hours per workday',
                                                )}
                                            </Label>
                                            <NumberField.Group>
                                                <NumberField.Input
                                                    ref={workdayInput}
                                                    onFocus={() =>
                                                        setFocusedNumberField(
                                                            'workday',
                                                        )
                                                    }
                                                    placeholder={String(
                                                        organization.workdayHours,
                                                    )}
                                                />
                                            </NumberField.Group>
                                            <FieldError>
                                                {form.errors.workday_hours}
                                            </FieldError>
                                        </NumberField>
                                    </div>
                                    <div className="grid gap-1">
                                        <span className="text-sm font-medium">
                                            {t('Working days')}
                                        </span>
                                        <ToggleButtonGroup
                                            aria-label={t('Working days')}
                                            selectionMode="multiple"
                                            selectedKeys={
                                                new Set(
                                                    form.data.working_days.map(
                                                        String,
                                                    ),
                                                )
                                            }
                                            onSelectionChange={(keys) =>
                                                form.setData(
                                                    'working_days',
                                                    [...keys]
                                                        .map(Number)
                                                        .sort((a, b) => a - b),
                                                )
                                            }
                                            isDetached
                                            size="sm"
                                            className="gap-2 max-md:grid max-md:w-full max-md:grid-cols-7 max-md:gap-1.5 md:flex-wrap"
                                        >
                                            {weekdays.map((day) => (
                                                <ToggleButton
                                                    key={day.value}
                                                    id={day.value}
                                                    aria-label={day.label}
                                                    className="rounded-full px-3 data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-soft-foreground max-md:h-9 max-md:w-full max-md:min-w-0 max-md:px-0"
                                                >
                                                    {day.shortLabel}
                                                </ToggleButton>
                                            ))}
                                        </ToggleButtonGroup>
                                        {form.errors.working_days && (
                                            <p
                                                role="alert"
                                                className="text-sm text-danger"
                                            >
                                                {form.errors.working_days}
                                            </p>
                                        )}
                                    </div>
                                </section>
                                <Separator />
                                <section className="grid gap-3">
                                    <h3 className="font-semibold">
                                        {t('Membership')}
                                    </h3>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {canChangeRole ? (
                                            <SelectField
                                                name="role"
                                                label={t('Role')}
                                                value={form.data.role}
                                                onChange={(role) =>
                                                    form.setData(
                                                        'role',
                                                        role as TeamMember['role'],
                                                    )
                                                }
                                                options={roles.filter(
                                                    (role) =>
                                                        role.value !== 'owner',
                                                )}
                                                error={form.errors.role}
                                                isRequired
                                            />
                                        ) : (
                                            <div className="grid content-start gap-1 text-sm">
                                                <span className="font-medium">
                                                    {t('Role')}
                                                </span>
                                                <span className="text-muted">
                                                    {member.roleLabel}
                                                </span>
                                            </div>
                                        )}
                                        {canViewRates && (
                                            <NumberField
                                                name="hourly_rate"
                                                value={
                                                    form.data.hourly_rate ?? NaN
                                                }
                                                onChange={(rate) =>
                                                    form.setData(
                                                        'hourly_rate',
                                                        Number.isFinite(rate)
                                                            ? rate
                                                            : null,
                                                    )
                                                }
                                                minValue={0}
                                                maxValue={1_000_000}
                                                step={0.01}
                                                formatOptions={{
                                                    maximumFractionDigits: 2,
                                                }}
                                                isInvalid={Boolean(
                                                    form.errors.hourly_rate,
                                                )}
                                                validationBehavior="aria"
                                            >
                                                <Label>
                                                    {t(
                                                        'Hourly rate (:currency)',
                                                        {
                                                            currency:
                                                                organization.currency +
                                                                '/h',
                                                        },
                                                    )}
                                                </Label>
                                                <NumberField.Group>
                                                    <NumberField.Input
                                                        ref={rateInput}
                                                        onFocus={() =>
                                                            setFocusedNumberField(
                                                                'rate',
                                                            )
                                                        }
                                                        placeholder={t(
                                                            'Default',
                                                        )}
                                                    />
                                                </NumberField.Group>
                                                <FieldError>
                                                    {form.errors.hourly_rate}
                                                </FieldError>
                                            </NumberField>
                                        )}
                                    </div>
                                </section>
                                {canDeactivate && (
                                    <>
                                        <Separator />
                                        <section className="grid justify-items-start gap-2">
                                            <h3 className="font-semibold">
                                                {t('Access')}
                                            </h3>
                                            <p className="text-sm text-muted">
                                                {t(
                                                    'Deactivation revokes access and keeps time records.',
                                                )}
                                            </p>
                                            <Button
                                                type="button"
                                                variant="danger-soft"
                                                size="sm"
                                                onPress={() =>
                                                    setConfirmDeactivate(true)
                                                }
                                            >
                                                {t('Deactivate member')}
                                            </Button>
                                        </section>
                                    </>
                                )}
                            </>
                        )}
                    </SideDrawerBody>
                    <SideDrawerFooter>
                        <HapticButton
                            type="button"
                            slot="close"
                            haptic={!member.isDeactivated}
                            variant="tertiary"
                            containerClassName={footerButtonLayoutClassName}
                            className={footerButtonClassName}
                        >
                            {member.isDeactivated ? t('Close') : t('Cancel')}
                        </HapticButton>
                        {member.isDeactivated ? (
                            <Button
                                type="button"
                                isPending={changingStatus}
                                onPress={changeStatus}
                                className={`${footerButtonLayoutClassName} ${footerButtonClassName}`}
                            >
                                {t('Reactivate member')}
                            </Button>
                        ) : (
                            <HapticButton
                                type="submit"
                                isPending={form.processing}
                                isDisabled={!form.isDirty || changingAvatar}
                                containerClassName={footerButtonLayoutClassName}
                                className={footerButtonClassName}
                            >
                                {t('Save changes')}
                            </HapticButton>
                        )}
                    </SideDrawerFooter>
                </form>
            </SideDrawer>
            <ConfirmDialog
                isOpen={confirmDeactivate}
                onOpenChange={setConfirmDeactivate}
                title={t('Deactivate member')}
                confirmLabel={t('Deactivate')}
                onConfirm={changeStatus}
                isPending={changingStatus}
            >
                {t('Deactivate :name? Their time records will be kept.', {
                    name: member.name,
                })}
            </ConfirmDialog>
        </>
    );
}
