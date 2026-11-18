import {
    Alert,
    Button,
    Description,
    Input,
    Label,
    Switch,
    TextArea,
    TextField,
} from '@heroui/react';
import { router } from '@inertiajs/react';
import { Copy, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { SelectField } from '@/components/form/select-field';
import type { SelectOption } from '@/components/form/select-field';
import { ResponsiveDialog } from '@/components/responsive-dialog';
import { ProjectPicker } from '@/components/time/project-picker';
import { useTranslation } from '@/lib/i18n';
import {
    formatDuration,
    minutesToTime,
    overlaps,
    parseDuration,
    secondsBetween,
    timeOf,
    timeToMinutes,
} from '@/lib/time';
import { destroy, store, update } from '@/routes/time';
import type { ProjectOption, TimeEntry, TimeEntryDraft } from '@/types';

type Props = {
    draft: TimeEntryDraft | null;
    onClose: () => void;
    projects: ProjectOption[];
    /** Entries already loaded, used to warn about overlaps. */
    entries: TimeEntry[];
    /** Members the viewer may report time for (owners and admins); hidden when empty. */
    members?: SelectOption[];
    onDuplicate?: (draft: TimeEntryDraft) => void;
};

export function TimeEntryForm({
    draft,
    onClose,
    projects,
    entries,
    members = [],
    onDuplicate,
}: Props) {
    const { t } = useTranslation();

    return (
        <ResponsiveDialog
            isOpen={draft !== null}
            onOpenChange={(isOpen) => !isOpen && onClose()}
            title={draft?.id ? t('Edit time') : t('Report time')}
        >
            {draft && (
                <TimeEntryFields
                    key={`${draft.id ?? 'new'}-${draft.date}-${draft.start}`}
                    draft={draft}
                    onClose={onClose}
                    projects={projects}
                    entries={entries}
                    members={members}
                    onDuplicate={onDuplicate}
                />
            )}
        </ResponsiveDialog>
    );
}

function TimeEntryFields({
    draft,
    onClose,
    projects,
    entries,
    members = [],
    onDuplicate,
}: Omit<Props, 'draft'> & { draft: TimeEntryDraft }) {
    const { t } = useTranslation();
    const [values, setValues] = useState(draft);
    const [duration, setDuration] = useState(
        draft.end ? formatDuration(secondsBetween(draft.start, draft.end)) : '',
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    const set = (changes: Partial<TimeEntryDraft>) =>
        setValues((current) => ({ ...current, ...changes }));

    const changeStart = (start: string) => {
        const seconds = parseDuration(duration);
        set({
            start,
            end: seconds
                ? minutesToTime(timeToMinutes(start) + seconds / 60)
                : values.end,
        });
    };

    const changeEnd = (end: string) => {
        set({ end });
        setDuration(
            end && values.start
                ? formatDuration(secondsBetween(values.start, end))
                : '',
        );
    };

    const changeDuration = (value: string) => {
        setDuration(value);
        const seconds = parseDuration(value);

        if (seconds && values.start) {
            set({
                end: minutesToTime(
                    timeToMinutes(values.start) + Math.min(seconds, 86400) / 60,
                ),
            });
        }
    };

    const changeProject = (projectId: string) => {
        const project = projects.find((option) => option.value === projectId);
        // New entries inherit "billable" from the project; edits keep their own value.
        set({
            projectId,
            isBillable: draft.id
                ? values.isBillable
                : (project?.isBillable ?? true),
        });
    };

    const durationSeconds =
        values.start && values.end
            ? secondsBetween(values.start, values.end)
            : null;
    const startAt = `${values.date}T${values.start}`;
    const overlapping =
        durationSeconds !== null &&
        entries.some(
            (entry) =>
                entry.id !== draft.id &&
                entry.userId === values.userId &&
                overlaps(
                    {
                        start: startAt,
                        end: addSeconds(startAt, durationSeconds),
                    },
                    entry,
                ),
        );

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const data = {
            user_id: values.userId,
            project_id:
                values.projectId === '' ? null : Number(values.projectId),
            description: values.description,
            date: values.date,
            start: values.start,
            end: values.end || null,
            duration: values.end ? null : duration,
            is_billable: values.isBillable,
        };
        const options = {
            preserveScroll: true,
            preserveState: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onError: (errorBag: Record<string, string>) => setErrors(errorBag),
            onSuccess: () => onClose(),
        };

        if (draft.id) {
            router.patch(update.url({ timeEntry: draft.id }), data, options);
        } else {
            router.post(store.url(), data, options);
        }
    };

    const remove = () => {
        if (!draft.id) {
            return;
        }

        router.delete(destroy.url({ timeEntry: draft.id }), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => onClose(),
        });
    };

    return (
        <form
            onSubmit={submit}
            className="grid gap-4"
            data-test="time-entry-form"
        >
            {members.length > 1 && (
                <SelectField
                    name="user_id"
                    label={t('Member')}
                    options={members}
                    value={String(values.userId)}
                    onChange={(userId) => set({ userId: Number(userId) })}
                    error={errors.user_id}
                    data-test="time-entry-member"
                />
            )}

            <ProjectPicker
                projects={projects}
                value={values.projectId}
                onChange={changeProject}
                error={errors.project_id}
                autoFocus={!draft.id && values.projectId === ''}
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="col-span-2 grid gap-1 text-sm sm:col-span-1">
                    <span className="font-medium">{t('Date')}</span>
                    <Input
                        type="date"
                        required
                        value={values.date}
                        onChange={(event) => set({ date: event.target.value })}
                    />
                </label>
                <label className="grid gap-1 text-sm">
                    <span className="font-medium">{t('Start')}</span>
                    <Input
                        type="time"
                        required
                        value={values.start}
                        onChange={(event) => changeStart(event.target.value)}
                        data-test="time-entry-start"
                    />
                </label>
                <label className="grid gap-1 text-sm">
                    <span className="font-medium">{t('End')}</span>
                    <Input
                        type="time"
                        value={values.end}
                        onChange={(event) => changeEnd(event.target.value)}
                        data-test="time-entry-end"
                    />
                </label>
                <label className="col-span-2 grid gap-1 text-sm sm:col-span-1">
                    <span className="font-medium">{t('Duration')}</span>
                    <Input
                        inputMode="decimal"
                        placeholder="1:30"
                        value={duration}
                        onChange={(event) => changeDuration(event.target.value)}
                        data-test="time-entry-duration"
                    />
                </label>
            </div>
            {(errors.start ||
                errors.end ||
                errors.ended_at ||
                errors.duration ||
                errors.date) && (
                <p className="text-sm text-danger">
                    {errors.ended_at ??
                        errors.duration ??
                        errors.end ??
                        errors.start ??
                        errors.date}
                </p>
            )}
            <p className="-mt-2 text-xs text-muted">
                {t('Enter an end time or a duration such as 1,5, 1:30 or 90m.')}
            </p>

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

            <TextField
                value={values.description}
                onChange={(description) => set({ description })}
                isInvalid={Boolean(errors.description)}
                className="w-full"
            >
                <Label>{t('Description')}</Label>
                <TextArea rows={2} placeholder={t('What did you work on?')} />
                {errors.description && (
                    <Description className="text-danger">
                        {errors.description}
                    </Description>
                )}
            </TextField>

            <Switch
                isSelected={values.isBillable ?? true}
                onChange={(isBillable) => set({ isBillable })}
            >
                <Switch.Control>
                    <Switch.Thumb />
                </Switch.Control>
                <Switch.Content>
                    <Label>{t('Billable')}</Label>
                </Switch.Content>
            </Switch>

            {errors.user_id && members.length <= 1 && (
                <p className="text-sm text-danger">{errors.user_id}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button
                    type="submit"
                    isPending={processing}
                    data-test="time-entry-save"
                >
                    {t('Save')}
                </Button>
                {draft.id && onDuplicate && (
                    <Button
                        variant="secondary"
                        onPress={() =>
                            onDuplicate({ ...values, id: undefined })
                        }
                        data-test="time-entry-duplicate"
                    >
                        <Copy className="size-4" />
                        {t('Duplicate')}
                    </Button>
                )}
                {draft.id && (
                    <Button
                        variant="danger-soft"
                        className="ml-auto"
                        onPress={remove}
                        data-test="time-entry-delete"
                    >
                        <Trash2 className="size-4" />
                        {t('Delete')}
                    </Button>
                )}
            </div>
        </form>
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
        date: entry.date,
        start: timeOf(entry.start),
        end: timeOf(entry.end),
        isBillable: entry.isBillable,
    };
}
