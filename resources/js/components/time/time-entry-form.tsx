import {
    Alert,
    Avatar,
    Button,
    Description,
    Dropdown,
    Input,
    Label,
    Switch,
    TextArea,
    TextField,
} from '@heroui/react';
import { Link, router, usePage } from '@inertiajs/react';
import { today } from '@internationalized/date';
import { Copy, Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { DatePickerField } from '@/components/form/date-picker-field';
import { TagInput } from '@/components/form/tag-input';
import { TimeInputField } from '@/components/form/time-input-field';
import { ResponsiveDialog } from '@/components/responsive-dialog';
import { ProjectPicker } from '@/components/time/project-picker';
import { TimeScrubLabel } from '@/components/time/time-scrub-label';
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from '@/lib/i18n';
import {
    addDays,
    formatDuration,
    minutesToTime,
    overlaps,
    parseDuration,
    secondsBetween,
    timeOf,
    timeToMinutes,
} from '@/lib/time';
import { cn } from '@/lib/utils';
import { index as projectsIndex } from '@/routes/projects';
import { destroy, store, update } from '@/routes/time';
import type {
    ProjectOption,
    TimeEntry,
    TimeEntryDraft,
    TimeEntryMemberOption,
} from '@/types';

type Props = {
    draft: TimeEntryDraft | null;
    onClose: () => void;
    projects: ProjectOption[];
    /** Entries already loaded, used to warn about overlaps. */
    entries: TimeEntry[];
    /** Members the viewer may report time for (owners and admins). */
    members?: TimeEntryMemberOption[];
    /** The organization's tag names, suggested in the tag field. */
    tags?: string[];
    recentTags: string[];
    /** Recently used project ids per member id, so the shortcuts follow the selected member. */
    recentProjects?: Record<string, string[]>;
    onDuplicate?: (draft: TimeEntryDraft) => void;
};

const FORM_ID = 'time-entry-form';
const MEMBER_ERROR_ID = 'time-entry-member-error';

function durationOf(draft: TimeEntryDraft): string {
    return draft.end
        ? formatDuration(secondsBetween(draft.start, draft.end))
        : '';
}

function offsetTime(value: string, fallback: string, offset: number): string {
    return offset === 0
        ? value
        : minutesToTime(timeToMinutes(value || fallback || '00:00') + offset);
}

function MemberAvatar({
    name,
    src,
    title,
    className,
}: {
    name?: string;
    src?: string | null;
    title?: string;
    className?: string;
}) {
    const getInitials = useInitials();

    return (
        <Avatar
            size="sm"
            variant="soft"
            color="accent"
            className={cn('rounded-full', className)}
            aria-hidden="true"
            title={title}
        >
            {src && <Avatar.Image src={src} alt="" className="object-cover" />}
            <Avatar.Fallback>
                {name ? getInitials(name) : <UserRound className="size-4" />}
            </Avatar.Fallback>
        </Avatar>
    );
}

/**
 * Report or edit time in a dialog (bottom sheet on mobile). Actions sit in the dialog footer so they
 * stay reachable while the fields scroll.
 */
export function TimeEntryForm({
    draft,
    onClose,
    projects,
    entries,
    members = [],
    tags = [],
    recentTags,
    recentProjects,
    onDuplicate,
}: Props) {
    const { t } = useTranslation();
    const { auth, can } = usePage().props;
    // The last opened draft: kept while the dialog animates out.
    const [source, setSource] = useState(draft);
    const [values, setValues] = useState<TimeEntryDraft | null>(draft);
    const [duration, setDuration] = useState(draft ? durationOf(draft) : '');
    const [hasTyped, setHasTyped] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [isMemberPickerOpen, setIsMemberPickerOpen] = useState(false);

    // Start from the draft each time a new one is opened.
    if (draft && draft !== source) {
        setSource(draft);
        setValues(draft);
        setDuration(durationOf(draft));
        setHasTyped(false);
        setErrors({});
        setIsMemberPickerOpen(false);
    }

    const current = values ?? draft;
    const isEditing = Boolean(source?.id);
    const todayDate = today(auth.user.timezone).toString();
    const dateLabel =
        current?.date === todayDate
            ? t('Today')
            : current?.date === addDays(todayDate, -1)
              ? t('Yesterday')
              : undefined;

    const set = (changes: Partial<TimeEntryDraft>) =>
        setValues((previous) =>
            previous ? { ...previous, ...changes } : previous,
        );

    const changeStart = (start: string) => {
        const seconds = parseDuration(duration);
        set({
            start,
            end:
                seconds && start
                    ? minutesToTime(timeToMinutes(start) + seconds / 60)
                    : current?.end,
        });
    };

    const changeEnd = (end: string) => {
        set({ end });
        setDuration(
            end && current?.start
                ? formatDuration(secondsBetween(current.start, end))
                : '',
        );
    };

    const changeDuration = (value: string) => {
        setDuration(value);
        const seconds = parseDuration(value);

        if (seconds && current?.start) {
            set({
                end: minutesToTime(
                    timeToMinutes(current.start) +
                        Math.min(seconds, 86400) / 60,
                ),
            });
        }
    };

    const restoreEndAndDuration = () => {
        set({ end: current?.end });
        setDuration(duration);
    };

    const adjustEnd = (offset: number) => {
        if (offset === 0) {
            restoreEndAndDuration();
            return;
        }

        changeEnd(offsetTime(current?.end ?? '', current?.start ?? '', offset));
    };

    const durationForDrag = Math.min(86400, parseDuration(duration) ?? 0);
    const adjustDuration = (offset: number) => {
        if (offset === 0) {
            restoreEndAndDuration();
            return;
        }

        const seconds = Math.min(86400, durationForDrag + offset * 60);
        if (seconds <= 0) {
            changeEnd('');
        } else {
            changeDuration(formatDuration(seconds));
        }
    };

    const changeProject = (projectId: string) => {
        const project = projects.find((option) => option.value === projectId);
        // New entries inherit "billable" from the project; edits keep their own value.
        set({
            projectId,
            isBillable: isEditing
                ? current?.isBillable
                : (project?.isBillable ?? true),
        });
    };

    const durationSeconds =
        current?.start && current.end
            ? secondsBetween(current.start, current.end)
            : null;
    const startAt = current ? `${current.date}T${current.start}` : '';
    const overlapping =
        current !== null &&
        durationSeconds !== null &&
        entries.some(
            (entry) =>
                entry.id !== source?.id &&
                entry.userId === current.userId &&
                overlaps(
                    {
                        start: startAt,
                        end: addSeconds(startAt, durationSeconds),
                    },
                    entry,
                ),
        );

    const requestOptions = {
        preserveScroll: true,
        preserveState: true,
        onStart: () => setProcessing(true),
        onFinish: () => setProcessing(false),
        onSuccess: () => onClose(),
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        if (!current) {
            return;
        }

        const data = {
            user_id: current.userId,
            project_id:
                current.projectId === '' ? null : Number(current.projectId),
            description: current.description,
            tags: current.tags,
            date: current.date,
            start: current.start,
            end: current.end || null,
            duration: current.end ? null : duration,
            is_billable: current.isBillable,
        };
        const options = {
            ...requestOptions,
            onError: (errorBag: Record<string, string>) => setErrors(errorBag),
        };

        if (source?.id) {
            router.patch(update.url({ timeEntry: source.id }), data, options);
        } else {
            router.post(store.url(), data, options);
        }
    };

    const remove = () => {
        if (source?.id) {
            router.delete(
                destroy.url({ timeEntry: source.id }),
                requestOptions,
            );
        }
    };

    const timeError =
        errors.ended_at ?? errors.duration ?? errors.end ?? errors.start;
    const memberId = String(current?.userId ?? '');
    const member = members.find((option) => option.value === memberId);
    const isSelf = current?.userId === auth.user.id;
    const memberName = isSelf ? auth.user.name : member?.label;
    const memberAvatar = isSelf ? auth.user.avatar : member?.avatar;
    const canChangeMember = members.length > 1;
    const memberLabel = memberName
        ? t('Reporting for :name', { name: memberName })
        : t('Member');
    const avatar = (
        <MemberAvatar
            name={memberName}
            src={memberAvatar}
            title={memberLabel}
        />
    );

    return (
        <ResponsiveDialog
            isOpen={draft !== null}
            onOpenChange={(isOpen) => !isOpen && onClose()}
            dismissOnEscape={
                draft?.fromCalendar && !isMemberPickerOpen
                    ? values === source && !hasTyped && !processing
                    : undefined
            }
            title={isEditing ? t('Edit time') : t('Report time')}
            headerActions={
                current &&
                (canChangeMember ? (
                    <Dropdown onOpenChange={setIsMemberPickerOpen}>
                        <Button
                            variant="ghost"
                            isIconOnly
                            className="size-9 min-w-0 shrink-0 rounded-full p-0"
                            aria-label={
                                memberName
                                    ? t('Change member (:name)', {
                                          name: memberName,
                                      })
                                    : t('Change member')
                            }
                            aria-describedby={
                                errors.user_id ? MEMBER_ERROR_ID : undefined
                            }
                            data-test="time-entry-member"
                        >
                            {avatar}
                        </Button>
                        <Dropdown.Popover
                            placement="bottom end"
                            className="min-w-48"
                        >
                            <Dropdown.Menu
                                aria-label={t('Choose a member')}
                                selectionMode="single"
                                disallowEmptySelection
                                selectedKeys={[memberId]}
                                onSelectionChange={(keys) => {
                                    if (keys !== 'all') {
                                        const [userId] = keys;
                                        if (userId !== undefined) {
                                            set({ userId: Number(userId) });
                                        }
                                    }
                                }}
                            >
                                {members.map(({ value, label, avatar }) => (
                                    <Dropdown.Item
                                        key={value}
                                        id={value}
                                        textValue={label}
                                    >
                                        <MemberAvatar
                                            name={label}
                                            src={avatar}
                                            className="size-9"
                                        />
                                        <Label>{label}</Label>
                                        <Dropdown.ItemIndicator />
                                    </Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                ) : (
                    <span
                        className="flex size-9 items-center justify-center"
                        role="img"
                        aria-label={memberLabel}
                    >
                        {avatar}
                    </span>
                ))
            }
            desktopClassName="sm:max-w-[40rem]"
            footer={
                <div className="flex w-full items-center gap-2">
                    {isEditing && (
                        <Button
                            variant="danger-soft"
                            onPress={remove}
                            aria-label={t('Delete')}
                            data-test="time-entry-delete"
                        >
                            <Trash2 className="size-4" />
                            <span className="hidden sm:inline">
                                {t('Delete')}
                            </span>
                        </Button>
                    )}
                    {isEditing && onDuplicate && current && (
                        <Button
                            variant="tertiary"
                            onPress={() =>
                                onDuplicate({ ...current, id: undefined })
                            }
                            aria-label={t('Duplicate')}
                            data-test="time-entry-duplicate"
                        >
                            <Copy className="size-4" />
                            <span className="hidden sm:inline">
                                {t('Duplicate')}
                            </span>
                        </Button>
                    )}
                    <div className="ml-auto flex gap-2">
                        <Button slot="close" variant="tertiary">
                            {t('Cancel')}
                        </Button>
                        <Button
                            type="submit"
                            form={FORM_ID}
                            isPending={processing}
                            data-test="time-entry-save"
                        >
                            {t('Save')}
                        </Button>
                    </div>
                </div>
            }
        >
            {current && (
                <form
                    id={FORM_ID}
                    onSubmit={submit}
                    onChange={() => setHasTyped(true)}
                    className="grid gap-5"
                    data-test="time-entry-form"
                >
                    {errors.user_id && (
                        <p
                            id={MEMBER_ERROR_ID}
                            role="alert"
                            className="text-sm text-danger"
                        >
                            {errors.user_id}
                        </p>
                    )}

                    {projects.length === 0 && (
                        <Alert status="warning" data-test="no-projects">
                            <Alert.Indicator />
                            <Alert.Content>
                                <Alert.Description>
                                    {can?.canManageProjects ? (
                                        <>
                                            {t(
                                                'There are no projects to report time on yet.',
                                            )}{' '}
                                            <Link
                                                href={projectsIndex(undefined, {
                                                    query: { new: 1 },
                                                })}
                                                className="font-medium underline"
                                            >
                                                {t('Create a project')}
                                            </Link>
                                        </>
                                    ) : (
                                        t(
                                            'There are no projects to report time on yet. Ask an administrator to add one.',
                                        )
                                    )}
                                </Alert.Description>
                            </Alert.Content>
                        </Alert>
                    )}

                    <ProjectPicker
                        projects={projects}
                        recentIds={
                            canChangeMember
                                ? (recentProjects?.[memberId] ?? [])
                                : undefined
                        }
                        value={current.projectId}
                        onChange={changeProject}
                        error={errors.project_id}
                        autoFocus={!isEditing && current.projectId === ''}
                    />

                    <div className="grid gap-2">
                        <div className="grid gap-3 md:grid-cols-[10rem_17.25rem_minmax(0,1fr)]">
                            <DatePickerField
                                label={t('Date')}
                                value={current.date}
                                onChange={(date) => set({ date })}
                                relativeLabel={dateLabel}
                                error={errors.date}
                                isRequired
                                data-test="time-entry-date"
                            />
                            <fieldset
                                aria-label={t('Start and end time')}
                                className="min-w-0"
                            >
                                <legend className="label mb-1 grid w-full grid-cols-2">
                                    <TimeScrubLabel
                                        label={t('Start')}
                                        value={current.start}
                                        minutes={
                                            current.start
                                                ? timeToMinutes(current.start)
                                                : undefined
                                        }
                                        isRequired
                                        onAdjust={(offset) =>
                                            changeStart(
                                                offsetTime(
                                                    current.start,
                                                    source?.start ?? '',
                                                    offset,
                                                ),
                                            )
                                        }
                                    />
                                    <TimeScrubLabel
                                        label={t('End')}
                                        value={current.end}
                                        minutes={
                                            current.end
                                                ? timeToMinutes(current.end)
                                                : undefined
                                        }
                                        onAdjust={adjustEnd}
                                    />
                                </legend>
                                <div
                                    className="grid h-9 grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] items-center rounded-field border-[length:var(--border-width-field)] border-[color:var(--field-border)] bg-field shadow-field focus-within:status-focused-field data-[invalid=true]:status-invalid-field"
                                    data-invalid={Boolean(
                                        errors.start ||
                                        errors.end ||
                                        errors.ended_at,
                                    )}
                                >
                                    <TimeInputField
                                        label={t('Start')}
                                        value={current.start}
                                        onChange={changeStart}
                                        isInvalid={Boolean(errors.start)}
                                        isRequired
                                        isEmbedded
                                        data-test="time-entry-start"
                                    />
                                    <span
                                        aria-hidden="true"
                                        className="h-5 bg-[var(--field-border)]"
                                    />
                                    <TimeInputField
                                        label={t('End')}
                                        value={current.end}
                                        onChange={changeEnd}
                                        isInvalid={Boolean(
                                            errors.end ?? errors.ended_at,
                                        )}
                                        isEmbedded
                                        data-test="time-entry-end"
                                    />
                                </div>
                            </fieldset>
                            <TextField
                                name="duration"
                                value={duration}
                                onChange={changeDuration}
                                validationBehavior="aria"
                                className="w-full"
                            >
                                <Label className="sr-only">
                                    {t('Duration')}
                                </Label>
                                <span className="label">
                                    <TimeScrubLabel
                                        label={t('Duration')}
                                        value={duration}
                                        minutes={
                                            duration
                                                ? Math.round(
                                                      durationForDrag / 60,
                                                  )
                                                : undefined
                                        }
                                        maxMinutes={1440}
                                        onAdjust={adjustDuration}
                                    />
                                </span>
                                <Input
                                    inputMode="decimal"
                                    placeholder="1:30"
                                    data-test="time-entry-duration"
                                />
                            </TextField>
                        </div>
                        {timeError ? (
                            <p className="text-sm text-danger">{timeError}</p>
                        ) : (
                            <p className="text-xs text-muted">
                                {t(
                                    'Enter an end time or a duration such as 1,5, 1:30 or 90m.',
                                )}{' '}
                                {t(
                                    'Drag the field label sideways to adjust in 15-minute steps.',
                                )}
                            </p>
                        )}
                    </div>

                    {overlapping && (
                        <Alert status="warning">
                            <Alert.Indicator />
                            <Alert.Content>
                                <Alert.Description>
                                    {t('This overlaps another entry.')}
                                </Alert.Description>
                            </Alert.Content>
                        </Alert>
                    )}

                    <TagInput
                        value={current.tags}
                        onChange={(tags) => set({ tags })}
                        suggestions={tags}
                        recentTags={recentTags}
                        error={
                            errors.tags ??
                            Object.entries(errors).find(([key]) =>
                                key.startsWith('tags.'),
                            )?.[1]
                        }
                    />

                    <TextField
                        value={current.description}
                        onChange={(description) => set({ description })}
                        isInvalid={Boolean(errors.description)}
                        className="w-full"
                    >
                        <Label>{t('Description')}</Label>
                        <TextArea
                            rows={3}
                            placeholder={t('What did you work on?')}
                        />
                        {errors.description && (
                            <Description className="text-danger">
                                {errors.description}
                            </Description>
                        )}
                    </TextField>

                    <Switch
                        isSelected={current.isBillable ?? true}
                        onChange={(isBillable) => set({ isBillable })}
                    >
                        <Switch.Content>
                            <Switch.Control>
                                <Switch.Thumb />
                            </Switch.Control>
                            <Label>{t('Billable')}</Label>
                        </Switch.Content>
                    </Switch>

                    {errors.user_id && members.length <= 1 && (
                        <p className="text-sm text-danger">{errors.user_id}</p>
                    )}
                </form>
            )}
        </ResponsiveDialog>
    );
}

function addSeconds(localDateTime: string, seconds: number): string {
    const value = new Date(`${localDateTime}:00Z`);
    value.setUTCSeconds(value.getUTCSeconds() + seconds);

    return value.toISOString().slice(0, 16);
}

export function draftFromEntry(entry: TimeEntry): TimeEntryDraft {
    return {
        id: entry.id,
        userId: entry.userId,
        projectId: String(entry.project.id),
        description: entry.description ?? '',
        tags: entry.tags,
        date: entry.date,
        start: timeOf(entry.start),
        end: timeOf(entry.end),
        isBillable: entry.isBillable,
    };
}
