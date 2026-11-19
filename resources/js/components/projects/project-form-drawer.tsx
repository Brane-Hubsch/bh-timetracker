import {
    Button,
    ColorSwatchPicker,
    Description,
    FieldError,
    Label,
    NumberField,
    Radio,
    RadioGroup,
    Switch,
    TextField,
    TextArea,
    parseColor,
} from '@heroui/react';
import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { DatePickerField } from '@/components/form/date-picker-field';
import { SelectField } from '@/components/form/select-field';
import { TextInputField } from '@/components/form/text-input-field';
import {
    SideDrawer,
    SideDrawerBody,
    SideDrawerFooter,
    sideDrawerFormClass,
} from '@/components/side-drawer';
import { toMinorUnits } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { store, update } from '@/routes/projects';
import type { ProjectFormOptions, ProjectFormValues } from '@/types';

type Props = {
    /** Edit this project, or create a new one when null. */
    project: ProjectFormValues | null;
    /** Preselected client for a new project. */
    defaultClientId?: number | null;
    options: ProjectFormOptions;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
};

const NO_CLIENT = 'none';

function initialValues(
    project: ProjectFormValues | null,
    defaultClientId: number | null,
    colors: string[],
) {
    return {
        name: project?.name ?? '',
        client_id: String(project?.clientId ?? defaultClientId ?? NO_CLIENT),
        code: project?.code ?? '',
        color: project?.color ?? colors[0],
        is_billable: project?.isBillable ?? true,
        hourly_rate:
            project?.hourlyRate === null || project?.hourlyRate === undefined
                ? ''
                : String(project.hourlyRate / 100),
        estimate_hours:
            project?.estimateSeconds === null ||
            project?.estimateSeconds === undefined
                ? ''
                : String(project.estimateSeconds / 3600),
        visibility: project?.visibility ?? 'public',
        starts_on: project?.startsOn ?? '',
        ends_on: project?.endsOn ?? '',
        notes: project?.notes ?? '',
    };
}

/**
 * Create or edit a project in a side drawer. A new project opens its project page after saving;
 * an edit closes the drawer and stays on the page.
 */
export function ProjectFormDrawer({
    project,
    defaultClientId = null,
    options: { clients, colors, currency },
    isOpen,
    onOpenChange,
}: Props) {
    const { t } = useTranslation();
    const form = useForm(initialValues(project, defaultClientId, colors));

    useEffect(() => {
        if (isOpen) {
            form.setData(initialValues(project, defaultClientId, colors));
            form.clearErrors();
        }
        // Start from the current values each time the drawer opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            client_id:
                data.client_id === NO_CLIENT ? null : Number(data.client_id),
            // Entered in major units (kronor), stored in minor units (öre).
            hourly_rate: toMinorUnits(data.hourly_rate),
            estimate_hours:
                data.estimate_hours === '' ? null : data.estimate_hours,
        }));

        if (project) {
            form.submit(update({ project: project.id }), {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => onOpenChange(false),
            });
        } else {
            form.submit(store());
        }
    };

    return (
        <SideDrawer
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title={project ? t('Edit project') : t('New project')}
        >
            <form onSubmit={submit} className={sideDrawerFormClass}>
                <SideDrawerBody>
                    <div className="grid gap-4">
                        <TextInputField
                            name="name"
                            label={t('Name')}
                            value={form.data.name}
                            onChange={(value) => form.setData('name', value)}
                            error={form.errors.name}
                            isRequired
                            autoFocus={!project}
                            data-test="project-name"
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <SelectField
                                name="client_id"
                                label={t('Client')}
                                value={form.data.client_id}
                                onChange={(value) =>
                                    form.setData('client_id', value)
                                }
                                options={[
                                    { value: NO_CLIENT, label: t('No client') },
                                    ...clients,
                                ]}
                                error={form.errors.client_id}
                            />
                            <TextInputField
                                name="code"
                                label={t('Code')}
                                description={t(
                                    'Optional short code, e.g. ACME-01.',
                                )}
                                value={form.data.code}
                                onChange={(value) =>
                                    form.setData('code', value)
                                }
                                error={form.errors.code}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>{t('Colour')}</Label>
                            <ColorSwatchPicker
                                aria-label={t('Colour')}
                                value={parseColor(form.data.color)}
                                onChange={(color) =>
                                    form.setData(
                                        'color',
                                        color.toString('hex').toLowerCase(),
                                    )
                                }
                            >
                                {colors.map((color) => (
                                    <ColorSwatchPicker.Item
                                        key={color}
                                        color={color}
                                    >
                                        <ColorSwatchPicker.Swatch />
                                        <ColorSwatchPicker.Indicator />
                                    </ColorSwatchPicker.Item>
                                ))}
                            </ColorSwatchPicker>
                        </div>
                    </div>

                    <div className="grid gap-4 border-t border-separator pt-6">
                        <Switch
                            isSelected={form.data.is_billable}
                            onChange={(value) =>
                                form.setData('is_billable', value)
                            }
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                                <div className="flex flex-col gap-0.5">
                                    <Label>{t('Billable')}</Label>
                                    <Description>
                                        {t(
                                            'New time entries on the project are billable by default.',
                                        )}
                                    </Description>
                                </div>
                            </Switch.Content>
                        </Switch>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <NumberField
                                value={
                                    form.data.hourly_rate === ''
                                        ? Number.NaN
                                        : Number(form.data.hourly_rate)
                                }
                                onChange={(value) =>
                                    form.setData(
                                        'hourly_rate',
                                        Number.isNaN(value)
                                            ? ''
                                            : String(value),
                                    )
                                }
                                minValue={0}
                                formatOptions={{ maximumFractionDigits: 2 }}
                                isInvalid={Boolean(form.errors.hourly_rate)}
                                className="w-full"
                            >
                                <Label>
                                    {t('Hourly rate')} ({currency}/h)
                                </Label>
                                <NumberField.Group>
                                    <NumberField.Input />
                                </NumberField.Group>
                                <Description>
                                    {t(
                                        'Leave empty to use the member or organization rate.',
                                    )}
                                </Description>
                                <FieldError>
                                    {form.errors.hourly_rate}
                                </FieldError>
                            </NumberField>
                            <NumberField
                                value={
                                    form.data.estimate_hours === ''
                                        ? Number.NaN
                                        : Number(form.data.estimate_hours)
                                }
                                onChange={(value) =>
                                    form.setData(
                                        'estimate_hours',
                                        Number.isNaN(value)
                                            ? ''
                                            : String(value),
                                    )
                                }
                                minValue={0}
                                formatOptions={{ maximumFractionDigits: 2 }}
                                isInvalid={Boolean(form.errors.estimate_hours)}
                                className="w-full"
                            >
                                <Label>{t('Estimate (hours)')}</Label>
                                <NumberField.Group>
                                    <NumberField.Input />
                                </NumberField.Group>
                                <FieldError>
                                    {form.errors.estimate_hours}
                                </FieldError>
                            </NumberField>
                        </div>
                    </div>

                    <div className="grid gap-4 border-t border-separator pt-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <DatePickerField
                                label={t('Starts on')}
                                value={form.data.starts_on}
                                onChange={(value) =>
                                    form.setData('starts_on', value)
                                }
                                error={form.errors.starts_on}
                            />
                            <DatePickerField
                                label={t('Ends on')}
                                value={form.data.ends_on}
                                onChange={(value) =>
                                    form.setData('ends_on', value)
                                }
                                error={form.errors.ends_on}
                            />
                        </div>

                        <RadioGroup
                            value={form.data.visibility}
                            onChange={(value) =>
                                form.setData(
                                    'visibility',
                                    value as 'public' | 'private',
                                )
                            }
                        >
                            <Label>{t('Visibility')}</Label>
                            <Radio value="public">
                                <Radio.Content>
                                    <Radio.Control>
                                        <Radio.Indicator />
                                    </Radio.Control>
                                    {t('Public: every member can report time')}
                                </Radio.Content>
                            </Radio>
                            <Radio value="private">
                                <Radio.Content>
                                    <Radio.Control>
                                        <Radio.Indicator />
                                    </Radio.Control>
                                    {t('Private: only assigned members')}
                                </Radio.Content>
                            </Radio>
                        </RadioGroup>
                    </div>

                    <div className="grid gap-4 border-t border-separator pt-6">
                        <TextField
                            value={form.data.notes}
                            onChange={(notes) => form.setData('notes', notes)}
                            isInvalid={Boolean(form.errors.notes)}
                            className="w-full"
                        >
                            <Label>{t('Notes')}</Label>
                            <TextArea
                                rows={5}
                                placeholder={t(
                                    'Scope, contacts, links… Visible to everyone on the project.',
                                )}
                                data-test="project-notes"
                            />
                            {form.errors.notes && (
                                <Description className="text-danger">
                                    {form.errors.notes}
                                </Description>
                            )}
                        </TextField>
                    </div>
                </SideDrawerBody>
                <SideDrawerFooter>
                    <Button slot="close" variant="tertiary">
                        {t('Cancel')}
                    </Button>
                    <Button
                        type="submit"
                        isPending={form.processing}
                        data-test="project-save"
                    >
                        {t('Save')}
                    </Button>
                </SideDrawerFooter>
            </form>
        </SideDrawer>
    );
}
