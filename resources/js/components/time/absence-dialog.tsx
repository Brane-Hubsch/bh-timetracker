import {
    Button,
    Description,
    Input,
    Label,
    TextArea,
    TextField,
} from '@heroui/react';
import { router } from '@inertiajs/react';
import { parseDate } from '@internationalized/date';
import { Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { DatePickerField } from '@/components/form/date-picker-field';
import { FieldPair } from '@/components/form/field-pair';
import { SelectField } from '@/components/form/select-field';
import { ResponsiveDialog } from '@/components/responsive-dialog';
import { SegmentedControl } from '@/components/segmented-control';
import { ScrubLabel, TimeScrubLabel } from '@/components/time/time-scrub-label';
import { formatHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { formatDuration, parseDuration, workingDays } from '@/lib/time';
import { destroy, store, update } from '@/routes/absences';
import type {
    Absence,
    AbsenceDraft,
    AbsenceType,
    AbsenceTypeOption,
} from '@/types';

type Props = {
    draft: AbsenceDraft | null;
    onClose: () => void;
    absenceTypes: AbsenceTypeOption[];
    recentAbsenceTypes: AbsenceType[];
    /** The organization's holidays around the shown week ("YYYY-MM-DD"). */
    holidays: string[];
    workdaySeconds: number;
};

export const ABSENCE_FORM_ID = 'absence-form';
const FORM_ID = ABSENCE_FORM_ID;
const MAX_MINUTES_PER_DAY = 24 * 60;

/** What the absence form needs from the page. */
export type AbsenceOptions = Pick<
    Props,
    'absenceTypes' | 'recentAbsenceTypes' | 'holidays' | 'workdaySeconds'
>;

function formatHoursPerDay(seconds: number): string {
    // Keep the stored value when decimal input or an import has sub-minute precision.
    return seconds % 60 === 0
        ? formatDuration(seconds)
        : (seconds / 3600).toFixed(6).replace('.', ',');
}

function offsetDate(value: string, fallback: string, offset: number): string {
    return offset === 0
        ? value
        : parseDate(value || fallback)
              .add({ days: offset })
              .toString();
}

function DateScrubLabel({
    label,
    value,
    onAdjust,
}: {
    label: string;
    value: string;
    onAdjust: (days: number) => void;
}) {
    const { t } = useTranslation();

    return (
        <ScrubLabel
            label={label}
            value={value}
            valueNow={value ? Date.parse(value) / 86_400_000 : undefined}
            step={1}
            help={t('Drag or use the arrow keys to adjust by one day.')}
            isRequired
            onAdjust={onAdjust}
        />
    );
}

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
                : formatHoursPerDay(absence.secondsPerDay),
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
            closeInHeader
            desktopClassName="sm:max-w-[40rem]"
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
    recentAbsenceTypes,
    holidays,
    workdaySeconds,
    userId,
}: AbsenceOptions & {
    draft: AbsenceDraft;
    onClose: () => void;
    userId?: number;
}) {
    const { t, tc, intlLocale } = useTranslation();
    const errorId = useId();
    const [values, setValues] = useState(draft);
    const [isPartial, setPartial] = useState(draft.hoursPerDay !== '');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const set = (changes: Partial<AbsenceDraft>) =>
        setValues((current) => ({ ...current, ...changes }));
    const changeType = (type: AbsenceDraft['type']) => set({ type });
    const typeSuggestions = [
        ...new Set([
            ...recentAbsenceTypes,
            ...absenceTypes.map(({ value }) => value),
        ]),
    ]
        .slice(0, 5)
        .map((value) => absenceTypes.find((option) => option.value === value))
        .filter((option) => option !== undefined);
    const changeStart = (startsOn: string) =>
        set({
            startsOn,
            // Advance the end if the new start would leave it behind.
            endsOn: startsOn > values.endsOn ? startsOn : values.endsOn,
        });

    const days =
        values.startsOn && values.endsOn && values.startsOn <= values.endsOn
            ? workingDays(values.startsOn, values.endsOn, holidays)
            : 0;
    const secondsPerDay = isPartial
        ? parseDuration(values.hoursPerDay)
        : workdaySeconds;
    const adjustHours = (offset: number) => {
        const seconds = (secondsPerDay ?? 0) + offset * 60;
        set({
            hoursPerDay:
                offset === 0 || (!values.hoursPerDay && seconds <= 0)
                    ? values.hoursPerDay
                    : formatHoursPerDay(
                          Math.min(
                              MAX_MINUTES_PER_DAY * 60,
                              Math.max(
                                  Math.min(secondsPerDay || 60, 60),
                                  seconds,
                              ),
                          ),
                      ),
        });
    };

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
            <div className="grid gap-2">
                <SelectField
                    name="type"
                    label={t('Type')}
                    value={values.type}
                    onChange={(type) =>
                        changeType(type as AbsenceDraft['type'])
                    }
                    options={absenceTypes}
                    error={errors.type}
                    isRequired
                    data-test="absence-type"
                />
                <div
                    role="group"
                    aria-label={t('Absence type suggestions')}
                    className="flex flex-wrap gap-1.5"
                    data-test="absence-type-suggestions"
                >
                    {typeSuggestions.map(({ value, label }) => (
                        <Button
                            key={value}
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 rounded-full border border-separator px-3 text-xs font-medium text-foreground"
                            onPress={() => changeType(value)}
                        >
                            <span
                                aria-hidden="true"
                                className="size-3 shrink-0 rounded-full border-[1.5px] border-muted"
                            />
                            {label}
                        </Button>
                    ))}
                </div>
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
            </div>

            <div className="grid gap-2 min-[370px]:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-3">
                <div
                    className={isPartial ? 'min-w-0' : 'col-span-full min-w-0'}
                >
                    <FieldPair
                        label={t('Absence period')}
                        isInvalid={Boolean(errors.starts_on || errors.ends_on)}
                        firstLabel={
                            <DateScrubLabel
                                label={t('From')}
                                value={values.startsOn}
                                onAdjust={(offset) =>
                                    changeStart(
                                        offsetDate(
                                            values.startsOn,
                                            draft.startsOn,
                                            offset,
                                        ),
                                    )
                                }
                            />
                        }
                        secondLabel={
                            <DateScrubLabel
                                label={t('To')}
                                value={values.endsOn}
                                onAdjust={(offset) => {
                                    const endsOn = offsetDate(
                                        values.endsOn,
                                        draft.endsOn,
                                        offset,
                                    );
                                    set({
                                        endsOn:
                                            offset !== 0 &&
                                            endsOn < values.startsOn
                                                ? values.startsOn
                                                : endsOn,
                                    });
                                }}
                            />
                        }
                        firstField={
                            <DatePickerField
                                label={t('From')}
                                value={values.startsOn}
                                onChange={changeStart}
                                error={errors.starts_on}
                                errorId={
                                    errors.starts_on
                                        ? `${errorId}-start`
                                        : undefined
                                }
                                className="min-w-0 self-stretch"
                                isRequired
                                isEmbedded
                                data-test="absence-starts-on"
                            />
                        }
                        secondField={
                            <DatePickerField
                                label={t('To')}
                                value={values.endsOn}
                                onChange={(endsOn) => set({ endsOn })}
                                error={errors.ends_on}
                                errorId={
                                    errors.ends_on
                                        ? `${errorId}-end`
                                        : undefined
                                }
                                className="min-w-0 self-stretch"
                                isRequired
                                isEmbedded
                                data-test="absence-ends-on"
                            />
                        }
                    />
                    {errors.starts_on && (
                        <p
                            id={`${errorId}-start`}
                            className="mt-1 text-sm text-danger"
                        >
                            {errors.starts_on}
                        </p>
                    )}
                    {errors.ends_on && (
                        <p
                            id={`${errorId}-end`}
                            className="mt-1 text-sm text-danger"
                        >
                            {errors.ends_on}
                        </p>
                    )}
                </div>
                {isPartial && (
                    <TextField
                        value={values.hoursPerDay}
                        onChange={(hoursPerDay) => set({ hoursPerDay })}
                        isInvalid={Boolean(errors.hours_per_day)}
                        validationBehavior="aria"
                        className="w-full min-[370px]:w-24 sm:w-32"
                    >
                        <Label className="sr-only">{t('Hours per day')}</Label>
                        <span className="label text-xs leading-5 whitespace-nowrap sm:text-sm">
                            <TimeScrubLabel
                                label={t('Hours per day')}
                                value={values.hoursPerDay}
                                minutes={
                                    secondsPerDay === null
                                        ? undefined
                                        : Math.min(
                                              MAX_MINUTES_PER_DAY,
                                              Math.round(secondsPerDay / 60),
                                          )
                                }
                                maxMinutes={MAX_MINUTES_PER_DAY}
                                onAdjust={adjustHours}
                            />
                        </span>
                        <Input
                            inputMode="decimal"
                            placeholder="4:00"
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
                <Label>{t('Description')}</Label>
                <TextArea rows={3} placeholder={t('Optional')} />
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
