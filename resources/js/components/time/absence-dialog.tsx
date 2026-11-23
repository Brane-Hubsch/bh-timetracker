import {
    Button,
    Description,
    Input,
    Label,
    TextArea,
    TextField,
} from '@heroui/react';
import { router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { DatePickerField } from '@/components/form/date-picker-field';
import { SelectField } from '@/components/form/select-field';
import { ResponsiveDialog } from '@/components/responsive-dialog';
import { SegmentedControl } from '@/components/segmented-control';
import { formatHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { parseDuration, workingDays } from '@/lib/time';
import { destroy, store, update } from '@/routes/absences';
import type { Absence, AbsenceDraft, AbsenceTypeOption } from '@/types';

type Props = {
    draft: AbsenceDraft | null;
    onClose: () => void;
    absenceTypes: AbsenceTypeOption[];
    /** The organization's holidays around the shown week ("YYYY-MM-DD"). */
    holidays: string[];
    workdaySeconds: number;
};

export const ABSENCE_FORM_ID = 'absence-form';
const FORM_ID = ABSENCE_FORM_ID;

/** What the absence form needs from the page. */
export type AbsenceOptions = Pick<
    Props,
    'absenceTypes' | 'holidays' | 'workdaySeconds'
>;

export function draftFromAbsence(absence: Absence): AbsenceDraft {
    return {
        id: absence.id,
        userId: absence.userId,
        type: absence.type,
        startsOn: absence.startsOn,
        endsOn: absence.endsOn,
        hoursPerDay:
            absence.secondsPerDay === null
                ? ''
                : String(absence.secondsPerDay / 3600).replace('.', ','),
        note: absence.note ?? '',
    };
}

/**
 * Register or edit absence (vacation, care of a sick child, …) for whole working days or some hours
 * per day. Weekends and the organization's holidays don't count.
 */
export function AbsenceDialog(props: Props) {
    const { t } = useTranslation();

    return (
        <ResponsiveDialog
            isOpen={props.draft !== null}
            onOpenChange={(isOpen) => !isOpen && props.onClose()}
            title={props.draft?.id ? t('Edit absence') : t('Register absence')}
            footer={<AbsenceDialogFooter {...props} />}
        >
            {props.draft && <AbsenceForm {...props} draft={props.draft} />}
        </ResponsiveDialog>
    );
}

function AbsenceDialogFooter({
    draft,
    onClose,
}: Pick<Props, 'draft' | 'onClose'>) {
    const { t } = useTranslation();
    const [isDeleting, setDeleting] = useState(false);

    return (
        <div className="flex w-full items-center gap-2">
            {draft?.id && (
                <Button
                    variant="danger-soft"
                    isIconOnly
                    aria-label={t('Delete absence')}
                    isPending={isDeleting}
                    onPress={() =>
                        draft.id &&
                        router.delete(destroy.url({ absence: draft.id }), {
                            preserveScroll: true,
                            preserveState: true,
                            onStart: () => setDeleting(true),
                            onFinish: () => setDeleting(false),
                            onSuccess: () => onClose(),
                        })
                    }
                    data-test="absence-delete"
                >
                    <Trash2 className="size-4" />
                </Button>
            )}
            <div className="ml-auto flex gap-2">
                <Button slot="close" variant="tertiary">
                    {t('Cancel')}
                </Button>
                <Button type="submit" form={FORM_ID} data-test="absence-save">
                    {t('Save')}
                </Button>
            </div>
        </div>
    );
}

/**
 * The absence fields, also used inside the time entry dialog when it is switched to absence.
 * `userId` overrides the draft's member while that dialog's member picker changes it.
 */
export function AbsenceForm({
    draft,
    onClose,
    absenceTypes,
    holidays,
    workdaySeconds,
    userId,
}: AbsenceOptions & {
    draft: AbsenceDraft;
    onClose: () => void;
    userId?: number;
}) {
    const { t, tc, intlLocale } = useTranslation();
    const [values, setValues] = useState(draft);
    const [isPartial, setPartial] = useState(draft.hoursPerDay !== '');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const set = (changes: Partial<AbsenceDraft>) =>
        setValues((current) => ({ ...current, ...changes }));

    const days =
        values.startsOn && values.endsOn && values.startsOn <= values.endsOn
            ? workingDays(values.startsOn, values.endsOn, holidays)
            : 0;
    const secondsPerDay = isPartial
        ? parseDuration(values.hoursPerDay)
        : workdaySeconds;

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        const data = {
            user_id: userId ?? values.userId,
            type: values.type,
            starts_on: values.startsOn,
            ends_on: values.endsOn,
            hours_per_day: isPartial ? values.hoursPerDay : null,
            note: values.note,
        };
        const options = {
            preserveScroll: true,
            preserveState: true,
            onError: (errorBag: Record<string, string>) => setErrors(errorBag),
            onSuccess: () => onClose(),
        };

        if (values.id) {
            router.patch(update.url({ absence: values.id }), data, options);
        } else {
            router.post(store.url(), data, options);
        }
    };

    return (
        <form
            id={FORM_ID}
            onSubmit={submit}
            className="grid gap-5"
            data-test="absence-form"
        >
            <SelectField
                name="type"
                label={t('Type')}
                value={values.type}
                onChange={(type) => set({ type: type as AbsenceDraft['type'] })}
                options={absenceTypes}
                error={errors.type}
                isRequired
                data-test="absence-type"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DatePickerField
                    label={t('From')}
                    value={values.startsOn}
                    onChange={(startsOn) =>
                        set({
                            startsOn,
                            // Keep the period valid when moving its start past the end.
                            endsOn:
                                startsOn && startsOn > values.endsOn
                                    ? startsOn
                                    : values.endsOn,
                        })
                    }
                    error={errors.starts_on}
                    isRequired
                    data-test="absence-starts-on"
                />
                <DatePickerField
                    label={t('To')}
                    value={values.endsOn}
                    onChange={(endsOn) => set({ endsOn })}
                    error={errors.ends_on}
                    isRequired
                    data-test="absence-ends-on"
                />
            </div>

            <div className="grid gap-2">
                <Label>{t('Extent')}</Label>
                <SegmentedControl
                    aria-label={t('Extent')}
                    value={isPartial ? 'hours' : 'days'}
                    onChange={(extent) => setPartial(extent === 'hours')}
                    className="w-fit"
                    options={[
                        { id: 'days', label: t('Full days') },
                        { id: 'hours', label: t('Hours per day') },
                    ]}
                    data-test="absence-extent"
                />
                {isPartial && (
                    <TextField
                        value={values.hoursPerDay}
                        onChange={(hoursPerDay) => set({ hoursPerDay })}
                        isInvalid={Boolean(errors.hours_per_day)}
                        aria-label={t('Hours per day')}
                        className="w-full sm:w-40"
                    >
                        <Input
                            inputMode="decimal"
                            placeholder="4"
                            autoFocus
                            data-test="absence-hours"
                        />
                        {errors.hours_per_day && (
                            <Description className="text-danger">
                                {errors.hours_per_day}
                            </Description>
                        )}
                    </TextField>
                )}
            </div>

            <TextField
                value={values.note}
                onChange={(note) => set({ note })}
                isInvalid={Boolean(errors.note)}
                className="w-full"
            >
                <Label>{t('Note')}</Label>
                <TextArea rows={2} placeholder={t('Optional')} />
                {errors.note && (
                    <Description className="text-danger">
                        {errors.note}
                    </Description>
                )}
            </TextField>

            <p
                className="rounded-xl bg-default px-3 py-2.5 text-sm text-muted"
                data-test="absence-summary"
            >
                {tc(':count working day|:count working days', days, {
                    count: days,
                })}
                {secondsPerDay
                    ? ` · ${formatHours(days * secondsPerDay, intlLocale)}`
                    : ''}{' '}
                {t('(weekends and holidays don’t count)')}
            </p>

            {errors.user_id && (
                <p className="text-sm text-danger">{errors.user_id}</p>
            )}
        </form>
    );
}
