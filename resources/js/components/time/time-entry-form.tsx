import {
    Alert,
    Avatar,
    Button,
    Dropdown,
    FieldError,
    Label,
    Tabs,
    TextArea,
    TextField,
} from '@heroui/react';
import { router, usePage } from '@inertiajs/react';
import { today } from '@internationalized/date';
import { Copy, EllipsisVertical, Play, Trash2, UserRound } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { DatePickerField } from '@/components/form/date-picker-field';
import { DurationInputField } from '@/components/form/duration-input-field';
import { FieldPair } from '@/components/form/field-pair';
import {
    SUBMIT_SHORTCUT,
    SubmitShortcutHint,
} from '@/components/form/submit-shortcut';
import { TagInput } from '@/components/form/tag-input';
import { TimeInputField } from '@/components/form/time-input-field';
import { HapticButton } from '@/components/haptic-button';
import { ResponsiveDialog } from '@/components/responsive-dialog';
import { ABSENCE_FORM_ID, AbsenceForm } from '@/components/time/absence-dialog';
import type { AbsenceOptions } from '@/components/time/absence-dialog';
import { ProjectPicker } from '@/components/time/project-picker';
import { TimeScrubLabel } from '@/components/time/time-scrub-label';
import { useFormErrors } from '@/hooks/use-form-errors';
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from '@/lib/i18n';
import {
    addDays,
    formatDuration,
    minutesToTime,
    parseDuration,
    secondsBetween,
    timeOf,
    timeToMinutes,
} from '@/lib/time';
import { cn } from '@/lib/utils';
import { index as projectsIndex } from '@/routes/projects';
import { destroy, store, update } from '@/routes/time';
import {
    discard as discardTimer,
    start as startTimer,
    stop as stopTimer,
    update as updateTimer,
} from '@/routes/timer';
import type {
    ProjectOption,
    TimeEntry,
    TimeEntryDraft,
    TimeEntryMemberOption,
    TimeReportMode,
} from '@/types';

type Props = {
    draft: TimeEntryDraft | null;
    onClose: () => void;
    projects: ProjectOption[];
    /** Members the viewer may report time for (owners and admins). */
    members?: TimeEntryMemberOption[];
    /** The organization's tag names, suggested in the tag field. */
    tags?: string[];
    recentTags: string[];
    /** Recently used project ids per member id, so the shortcuts follow the selected member. */
    recentProjects?: Record<string, string[]>;
    onCreate?: (durationSeconds: number) => void;
    onDuplicate?: (draft: TimeEntryDraft) => void;
    /** Lets a new entry switch to registering absence instead. */
    absence?: AbsenceOptions;
};

const FORM_ID = 'time-entry-form';
const MEMBER_ERROR_ID = 'time-entry-member-error';
const reportModes: TimeReportMode[] = ['time', 'absence'];

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
 * Report or edit time in a dialog. Actions sit in the dialog footer so they
 * stay reachable while the fields scroll.
 */
export function TimeEntryForm({
    draft,
    onClose,
    projects,
    members = [],
    tags = [],
    recentTags,
    recentProjects,
    onCreate,
    onDuplicate,
    absence,
}: Props) {
    const { t } = useTranslation();
    const { auth, can, currentOrganization } = usePage().props;
    const timerEnabled = currentOrganization?.timerEnabled ?? false;
    // The last opened draft: kept while the dialog animates out.
    const [source, setSource] = useState(draft);
    const [values, setValues] = useState<TimeEntryDraft | null>(draft);
    const [duration, setDuration] = useState(draft ? durationOf(draft) : '');
    const [hasTyped, setHasTyped] = useState(false);
    const { errors, setErrors, clearErrors } = useFormErrors();
    const [processing, setProcessing] = useState(false);
    const [isMemberPickerOpen, setIsMemberPickerOpen] = useState(false);
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
    const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
    const [mode, setMode] = useState<TimeReportMode | null>(
        draft?.reportMode ?? null,
    );
    const modeIndicator = useRef<HTMLSpanElement>(null);
    const observeSelectedTab = useCallback((tab: HTMLDivElement | null) => {
        const tabList = tab?.parentElement;
        if (!tab || !tabList) {
            return;
        }

        const observer = new ResizeObserver(() => {
            const indicator = modeIndicator.current;
            if (!indicator) {
                return;
            }

            // Measure relative to the list so a resizing dialog cannot move the line vertically.
            const { left, width } = tab.getBoundingClientRect();
            const offset = left - tabList.getBoundingClientRect().left;
            indicator.style.translate = `${offset}px`;
            indicator.style.width = `${width}px`;
        });
        observer.observe(tab);
        observer.observe(tabList);

        return () => observer.disconnect();
    }, []);

    // Start from the draft each time a new one is opened.
    if (draft && draft !== source) {
        setSource(draft);
        setValues(draft);
        setDuration(durationOf(draft));
        setHasTyped(false);
        setErrors({});
        setIsMemberPickerOpen(false);
        setIsActionsMenuOpen(false);
        setIsTimePickerOpen(false);
        setMode(draft.reportMode ?? null);
    }

    const current = values ?? draft;
    const isEditing = Boolean(source?.id);
    // Editing the running timer: saved, stopped or discarded instead of being an entry.
    const isTimer = Boolean(source?.timer);
    const isNewEntry = !isEditing && !isTimer;
    const canSwitchMode = Boolean(absence) && isNewEntry;
    const isAbsence = canSwitchMode && mode === 'absence';
    const [beforeType, afterType] = t('Report :type').split(':type');
    const selectedMode = isAbsence ? 'absence' : 'time';
    const ModePanel = canSwitchMode ? Tabs.Panel : 'div';
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
        const end =
            seconds && start
                ? minutesToTime(timeToMinutes(start) + seconds / 60)
                : current?.end;

        if (start !== current?.start) {
            clearErrors('start', 'ended_at');
        }
        if (end !== current?.end) {
            clearErrors('end', 'duration', 'ended_at');
        }
        set({ start, end });
    };

    const changeEnd = (end: string) => {
        if (end !== current?.end) {
            clearErrors('end', 'duration', 'ended_at');
        }
        set({ end });
        setDuration(
            end && current?.start
                ? formatDuration(secondsBetween(current.start, end))
                : '',
        );
    };

    const changeDuration = (value: string) => {
        if (value !== duration) {
            clearErrors('end', 'duration', 'ended_at');
        }
        setHasTyped(true);
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
        if (projectId !== current?.projectId) {
            clearErrors('project_id');
        }
        // New entries inherit "billable" from the project; edits keep their own value.
        set({
            projectId,
            isBillable: isEditing
                ? current?.isBillable
                : (project?.isBillable ?? true),
        });
    };

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

        if (isTimer) {
            router.patch(updateTimer.url(), timerData() ?? {}, withErrors);

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
            router.post(store.url(), data, {
                ...options,
                onSuccess: () => {
                    onCreate?.(
                        current.end
                            ? secondsBetween(current.start, current.end)
                            : (parseDuration(duration) ?? 0),
                    );
                    requestOptions.onSuccess();
                },
            });
        }
    };

    const timerData = () =>
        current && {
            project_id:
                current.projectId === '' ? null : Number(current.projectId),
            description: current.description,
            tags: current.tags,
            is_billable: current.isBillable,
            date: current.date,
            start: current.start,
        };
    const withErrors = {
        ...requestOptions,
        onError: (errorBag: Record<string, string>) => setErrors(errorBag),
    };

    // Start a new timer with the same project, description and tags as this entry.
    const continueEntry = () =>
        current &&
        router.post(
            startTimer.url(),
            {
                project_id: Number(current.projectId),
                description: current.description,
                tags: current.tags,
                is_billable: current.isBillable,
            },
            withErrors,
        );

    const stopTimerFromForm = () => {
        if (!current) {
            return;
        }

        // An end at or before the start is on the next day, as for entries.
        const end = current.end
            ? {
                  end_date:
                      current.end <= current.start
                          ? addDays(current.date, 1)
                          : current.date,
                  end: current.end,
              }
            : {};

        router.post(stopTimer.url(), { ...timerData(), ...end }, withErrors);
    };

    const discardTimerFromForm = () =>
        router.delete(discardTimer.url(), requestOptions);

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
    const canChangeMember = members.length > 1 && !isTimer;
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

    const memberPicker =
        current &&
        (canChangeMember ? (
            <Dropdown onOpenChange={setIsMemberPickerOpen}>
                <Button
                    type="button"
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
                    placement="top start"
                    offset={8}
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
                                    if (String(userId) !== memberId) {
                                        clearErrors('user_id');
                                    }
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
        ));

    return (
        <ResponsiveDialog
            isOpen={draft !== null}
            onOpenChange={(isOpen) => !isOpen && onClose()}
            // ⌘/Ctrl+Enter saves; for the running timer it stops it.
            submitFormId={
                isTimer ? undefined : isAbsence ? ABSENCE_FORM_ID : FORM_ID
            }
            onSubmitShortcut={isTimer ? stopTimerFromForm : undefined}
            dismissOnEscape={
                draft?.openedFrom === 'calendar' &&
                !isMemberPickerOpen &&
                !isActionsMenuOpen &&
                !isTimePickerOpen
                    ? values === source && !hasTyped && !processing
                    : undefined
            }
            title={
                isTimer
                    ? t('Running timer')
                    : isEditing
                      ? t('Edit time')
                      : t('Report :type', { type: t(selectedMode) })
            }
            headerContent={
                canSwitchMode && (
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-xl/7 font-semibold">
                        <span aria-hidden="true">{beforeType.trim()}</span>
                        <div className="relative">
                            <Tabs.List
                                aria-label={t('Report type')}
                                className="min-w-0! gap-1.5 p-0"
                                data-test="time-entry-mode"
                            >
                                {reportModes.map((reportMode) => (
                                    <Tabs.Tab
                                        key={reportMode}
                                        id={reportMode}
                                        ref={
                                            reportMode === selectedMode
                                                ? observeSelectedTab
                                                : undefined
                                        }
                                        className="h-9 w-auto rounded-sm px-0 text-xl/7 font-semibold text-muted/50 hover:text-foreground hover:opacity-100 aria-selected:text-foreground"
                                    >
                                        {t(reportMode)}
                                    </Tabs.Tab>
                                ))}
                            </Tabs.List>
                            <span
                                ref={modeIndicator}
                                aria-hidden="true"
                                className={cn(
                                    'pointer-events-none absolute top-7 left-0 h-0.5 w-0 bg-accent',
                                    mode &&
                                        'transition-[translate,width] duration-240 ease-out-soft motion-reduce:transition-none',
                                )}
                                data-test="report-mode-indicator"
                            />
                        </div>
                        {afterType && (
                            <span aria-hidden="true">{afterType.trim()}</span>
                        )}
                    </div>
                )
            }
            wrapContent={
                canSwitchMode
                    ? (content) => (
                          <Tabs
                              className="contents"
                              selectedKey={selectedMode}
                              onSelectionChange={(key) =>
                                  setMode(
                                      key === 'absence' ? 'absence' : 'time',
                                  )
                              }
                          >
                              {content}
                          </Tabs>
                      )
                    : undefined
            }
            closeInHeader
            fullScreenOnMobile={isNewEntry}
            desktopClassName="sm:max-w-xl"
            containerClassName={isEditing ? 'overlay-fade' : undefined}
            footer={
                <div className="flex w-full items-center gap-2">
                    {memberPicker}
                    {isEditing && (
                        <Dropdown onOpenChange={setIsActionsMenuOpen}>
                            <Button
                                type="button"
                                variant="tertiary"
                                isIconOnly
                                aria-label={t('Time entry actions')}
                                data-test="time-entry-actions"
                            >
                                <EllipsisVertical className="size-4" />
                            </Button>
                            <Dropdown.Popover
                                placement="bottom start"
                                className="min-w-40 rounded-3xl"
                            >
                                <Dropdown.Menu
                                    aria-label={t('Time entry actions')}
                                    className="gap-0"
                                >
                                    {timerEnabled && isSelf && (
                                        <Dropdown.Item
                                            id="continue"
                                            textValue={t(
                                                'Continue with a timer',
                                            )}
                                            onAction={continueEntry}
                                            className="px-3"
                                            data-test="time-entry-continue"
                                        >
                                            <Play className="size-4 shrink-0" />
                                            <Label>
                                                {t('Continue with a timer')}
                                            </Label>
                                        </Dropdown.Item>
                                    )}
                                    {onDuplicate && current && (
                                        <Dropdown.Item
                                            id="duplicate"
                                            textValue={t('Duplicate')}
                                            onAction={() =>
                                                onDuplicate({
                                                    ...current,
                                                    id: undefined,
                                                })
                                            }
                                            className="px-3"
                                            data-test="time-entry-duplicate"
                                        >
                                            <Copy className="size-4 shrink-0" />
                                            <Label>{t('Duplicate')}</Label>
                                        </Dropdown.Item>
                                    )}
                                    <Dropdown.Item
                                        id="delete"
                                        textValue={t('Delete')}
                                        onAction={remove}
                                        variant="danger"
                                        className="px-3"
                                        data-test="time-entry-delete"
                                    >
                                        <Trash2 className="size-4 shrink-0 text-danger" />
                                        <Label>{t('Delete')}</Label>
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown.Popover>
                        </Dropdown>
                    )}
                    {isTimer && (
                        <Button
                            isIconOnly
                            variant="danger-soft"
                            aria-label={t('Discard the timer')}
                            onPress={discardTimerFromForm}
                            data-test="timer-discard"
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    )}
                    <div className="ml-auto flex gap-2">
                        {isTimer ? (
                            <>
                                <HapticButton
                                    type="submit"
                                    form={FORM_ID}
                                    variant="tertiary"
                                    isPending={processing}
                                    data-test="timer-save"
                                >
                                    {t('Save')}
                                </HapticButton>
                                <Button
                                    onPress={stopTimerFromForm}
                                    isPending={processing}
                                    aria-keyshortcuts={SUBMIT_SHORTCUT}
                                    data-test="timer-stop"
                                >
                                    {t('Stop')}
                                    <SubmitShortcutHint />
                                </Button>
                            </>
                        ) : (
                            <>
                                <HapticButton slot="close" variant="tertiary">
                                    {t('Cancel')}
                                </HapticButton>
                                <HapticButton
                                    type="submit"
                                    form={isAbsence ? ABSENCE_FORM_ID : FORM_ID}
                                    isPending={processing}
                                    aria-keyshortcuts={SUBMIT_SHORTCUT}
                                    data-test={
                                        isAbsence
                                            ? 'absence-save'
                                            : 'time-entry-save'
                                    }
                                >
                                    {t('Save')}
                                    <SubmitShortcutHint />
                                </HapticButton>
                            </>
                        )}
                    </div>
                </div>
            }
        >
            {current && (
                <ModePanel
                    key={selectedMode}
                    id={canSwitchMode ? selectedMode : undefined}
                    className={cn('m-0 grid gap-5 p-0', isNewEntry && 'pt-1')}
                >
                    {isAbsence && absence ? (
                        <AbsenceForm
                            {...absence}
                            draft={{
                                userId: current.userId,
                                type: 'vacation',
                                startsOn: current.date,
                                endsOn: current.date,
                                hoursPerDay:
                                    source?.openedFrom === 'calendar'
                                        ? durationOf(source)
                                        : '',
                                note: '',
                            }}
                            userId={current.userId}
                            onClose={onClose}
                            onTimePickerOpenChange={setIsTimePickerOpen}
                        />
                    ) : (
                        <form
                            id={FORM_ID}
                            onSubmit={submit}
                            onChange={() => setHasTyped(true)}
                            className="time-entry-form grid gap-5"
                            data-test="time-entry-form"
                        >
                            {errors.timer && (
                                <p
                                    role="alert"
                                    className="text-sm text-danger"
                                    data-test="timer-error"
                                >
                                    {errors.timer}
                                </p>
                            )}
                            {errors.user_id && (
                                <p
                                    id={MEMBER_ERROR_ID}
                                    role="alert"
                                    className="text-sm text-danger"
                                >
                                    {errors.user_id}
                                </p>
                            )}

                            {projects.length === 0 &&
                                !can?.canManageProjects && (
                                    <Alert
                                        status="warning"
                                        data-test="no-projects"
                                    >
                                        <Alert.Indicator />
                                        <Alert.Content>
                                            <Alert.Description>
                                                {t(
                                                    'There are no projects to report time on yet. Ask an administrator to add one.',
                                                )}
                                            </Alert.Description>
                                        </Alert.Content>
                                    </Alert>
                                )}

                            <ProjectPicker
                                projects={projects}
                                createProjectUrl={
                                    can?.canManageProjects
                                        ? projectsIndex.url(undefined, {
                                              query: { new: 1 },
                                          })
                                        : undefined
                                }
                                recentIds={
                                    canChangeMember
                                        ? (recentProjects?.[memberId] ?? [])
                                        : undefined
                                }
                                value={current.projectId}
                                onChange={changeProject}
                                isBillable={current.isBillable ?? true}
                                onBillableChange={(isBillable) =>
                                    set({ isBillable })
                                }
                                error={errors.project_id}
                                autoFocus={
                                    !isEditing &&
                                    mode === null &&
                                    current.projectId === ''
                                }
                            />

                            <div className="grid gap-2">
                                <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 md:grid-cols-[9rem_15.25rem_minmax(0,1fr)]">
                                    <DatePickerField
                                        label={t('Date')}
                                        value={current.date}
                                        onChange={(date) => {
                                            clearErrors('date', 'ended_at');
                                            set({ date });
                                        }}
                                        relativeLabel={dateLabel}
                                        error={errors.date}
                                        isRequired
                                        className="w-full max-md:col-span-2"
                                        data-test="time-entry-date"
                                    />
                                    <FieldPair
                                        label={t('Start and end time')}
                                        firstLabel={
                                            <TimeScrubLabel
                                                label={t('Start')}
                                                value={current.start}
                                                minutes={
                                                    current.start
                                                        ? timeToMinutes(
                                                              current.start,
                                                          )
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
                                        }
                                        secondLabel={
                                            <TimeScrubLabel
                                                label={t('End')}
                                                value={current.end}
                                                minutes={
                                                    current.end
                                                        ? timeToMinutes(
                                                              current.end,
                                                          )
                                                        : undefined
                                                }
                                                onAdjust={adjustEnd}
                                            />
                                        }
                                        isInvalid={Boolean(
                                            errors.start ||
                                            errors.end ||
                                            errors.ended_at,
                                        )}
                                        firstField={
                                            <TimeInputField
                                                label={t('Start')}
                                                pickerTitle={t(
                                                    'Choose start time',
                                                )}
                                                value={current.start}
                                                defaultTime={source?.start}
                                                onChange={changeStart}
                                                onPickerOpenChange={
                                                    setIsTimePickerOpen
                                                }
                                                isInvalid={Boolean(
                                                    errors.start,
                                                )}
                                                isRequired
                                                isEmbedded
                                                data-test="time-entry-start"
                                            />
                                        }
                                        secondField={
                                            <TimeInputField
                                                label={t('End')}
                                                pickerTitle={t(
                                                    'Choose end time',
                                                )}
                                                value={current.end}
                                                defaultTime={current.start}
                                                onChange={changeEnd}
                                                onPickerOpenChange={
                                                    setIsTimePickerOpen
                                                }
                                                isInvalid={Boolean(
                                                    errors.end ??
                                                    errors.ended_at,
                                                )}
                                                isEmbedded
                                                data-test="time-entry-end"
                                            />
                                        }
                                    />
                                    <DurationInputField
                                        label={t('Duration')}
                                        pickerTitle={t('Choose duration')}
                                        name="duration"
                                        value={duration}
                                        onChange={changeDuration}
                                        onPickerOpenChange={setIsTimePickerOpen}
                                        preview={(minutes) =>
                                            current.start && minutes > 0
                                                ? t('End :time', {
                                                      time: minutesToTime(
                                                          timeToMinutes(
                                                              current.start,
                                                          ) + minutes,
                                                      ),
                                                  })
                                                : undefined
                                        }
                                        className="w-full"
                                        visibleLabel={
                                            <span className="label">
                                                <TimeScrubLabel
                                                    label={t('Duration')}
                                                    value={duration}
                                                    minutes={
                                                        duration
                                                            ? Math.round(
                                                                  durationForDrag /
                                                                      60,
                                                              )
                                                            : undefined
                                                    }
                                                    maxMinutes={1440}
                                                    onAdjust={adjustDuration}
                                                />
                                            </span>
                                        }
                                        placeholder="1:30"
                                        data-test="time-entry-duration"
                                    />
                                </div>
                                {timeError ? (
                                    <p className="text-sm text-danger">
                                        {timeError}
                                    </p>
                                ) : isTimer ? (
                                    <p
                                        className="text-xs text-muted"
                                        data-test="timer-help"
                                    >
                                        {source?.stopTimer && source.end
                                            ? t(
                                                  'The timer has run a long time. Check the end before stopping.',
                                              )
                                            : source?.stopTimer
                                              ? t(
                                                    'Choose a project to stop the timer.',
                                                )
                                              : t(
                                                    'The timer is running. Change the start if you started earlier; leave the end empty to stop it now.',
                                                )}
                                    </p>
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

                            <TextField
                                value={current.description}
                                onChange={(description) => {
                                    clearErrors('description');
                                    set({ description });
                                }}
                                isInvalid={Boolean(errors.description)}
                                validationBehavior="aria"
                                className="w-full"
                            >
                                <Label>{t('Description')}</Label>
                                <div className="time-entry-field-frame">
                                    <TextArea
                                        className="block w-full"
                                        rows={3}
                                        placeholder={t('What did you work on?')}
                                    />
                                </div>
                                <FieldError>{errors.description}</FieldError>
                            </TextField>

                            <TagInput
                                value={current.tags}
                                onChange={(tags) => {
                                    clearErrors('tags');
                                    set({ tags });
                                }}
                                suggestions={tags}
                                recentTags={recentTags}
                                error={
                                    errors.tags ??
                                    Object.entries(errors).find(([key]) =>
                                        key.startsWith('tags.'),
                                    )?.[1]
                                }
                            />

                            {errors.user_id && members.length <= 1 && (
                                <p className="text-sm text-danger">
                                    {errors.user_id}
                                </p>
                            )}
                        </form>
                    )}
                </ModePanel>
            )}
        </ResponsiveDialog>
    );
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
