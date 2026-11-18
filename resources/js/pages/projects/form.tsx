import {
    Button,
    ColorSwatchPicker,
    Description,
    FieldError,
    Input,
    Label,
    NumberField,
    Radio,
    RadioGroup,
    Switch,
    parseColor,
} from '@heroui/react';
import { Head, useForm } from '@inertiajs/react';
import Heading from '@/components/heading';
import type { SelectOption } from '@/components/form/select-field';
import { SelectField } from '@/components/form/select-field';
import { TextInputField } from '@/components/form/text-input-field';
import { toMinorUnits } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { index, store, update } from '@/routes/projects';
import type { ProjectFormValues } from '@/types';

type Props = {
    project: ProjectFormValues | null;
    defaultClientId: number | null;
    clients: SelectOption[];
    colors: string[];
    currency: string;
};

const NO_CLIENT = 'none';

export default function ProjectForm({
    project,
    defaultClientId,
    clients,
    colors,
    currency,
}: Props) {
    const { t } = useTranslation();
    const form = useForm({
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
    });

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
        form.submit(project ? update({ project: project.id }) : store());
    };

    const title = project ? t('Edit project') : t('New project');

    return (
        <>
            <Head title={title} />

            <form onSubmit={submit} className="grid max-w-2xl gap-6">
                <Heading title={title} />

                <div className="grid gap-4 rounded-2xl bg-surface p-4 shadow-surface sm:p-6">
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
                            onChange={(value) => form.setData('code', value)}
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

                <div className="grid gap-4 rounded-2xl bg-surface p-4 shadow-surface sm:p-6">
                    <Switch
                        isSelected={form.data.is_billable}
                        onChange={(value) => form.setData('is_billable', value)}
                    >
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Content>
                            <Label>{t('Billable')}</Label>
                            <Description>
                                {t(
                                    'New time entries on the project are billable by default.',
                                )}
                            </Description>
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
                                    Number.isNaN(value) ? '' : String(value),
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
                            <FieldError>{form.errors.hourly_rate}</FieldError>
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
                                    Number.isNaN(value) ? '' : String(value),
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

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm">
                            <span className="font-medium">
                                {t('Starts on')}
                            </span>
                            <Input
                                type="date"
                                value={form.data.starts_on}
                                onChange={(event) =>
                                    form.setData(
                                        'starts_on',
                                        event.target.value,
                                    )
                                }
                            />
                            {form.errors.starts_on && (
                                <span className="text-danger">
                                    {form.errors.starts_on}
                                </span>
                            )}
                        </label>
                        <label className="grid gap-1 text-sm">
                            <span className="font-medium">{t('Ends on')}</span>
                            <Input
                                type="date"
                                value={form.data.ends_on}
                                onChange={(event) =>
                                    form.setData('ends_on', event.target.value)
                                }
                            />
                            {form.errors.ends_on && (
                                <span className="text-danger">
                                    {form.errors.ends_on}
                                </span>
                            )}
                        </label>
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

                <div className="flex gap-2">
                    <Button
                        type="submit"
                        isPending={form.processing}
                        data-test="project-save"
                    >
                        {t('Save')}
                    </Button>
                </div>
            </form>
        </>
    );
}

ProjectForm.layout = {
    breadcrumbs: [
        { title: 'Projects', href: index() },
        { title: 'Project', href: '#' },
    ],
};
