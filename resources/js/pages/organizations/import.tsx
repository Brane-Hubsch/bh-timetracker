import {
    Alert,
    Avatar,
    Button,
    Checkbox,
    Chip,
    Label,
    NumberField,
    Switch,
} from '@heroui/react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { FileUp, Upload } from 'lucide-react';
import { useState } from 'react';
import { DropZone, FileTrigger } from 'react-aria-components';
import { SelectField } from '@/components/form/select-field';
import type { SelectOption } from '@/components/form/select-field';
import Heading from '@/components/heading';
import { useInitials } from '@/hooks/use-initials';
import { formatDecimalHours, toMinorUnits } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { edit, index } from '@/routes/organizations';
import { destroy, run, show, store } from '@/routes/organizations/import';
import { summary as reportSummary } from '@/routes/reports';
import type {
    ImportPreview,
    ImportRate,
    ImportResult,
    SkippedImportRow,
} from '@/types';

type Props = {
    organization: { name: string; slug: string };
    preview: ImportPreview | null;
    memberOptions?: SelectOption[];
};

const SKIP = 'skip';

/**
 * Import from Clockify: upload the CSV export, review the preview (who the time goes to, which
 * clients and projects are created, what is skipped and why), then import.
 */
export default function OrganizationImport({
    organization,
    preview,
    memberOptions = [],
}: Props) {
    const { t } = useTranslation();
    const { flash } = usePage();

    return (
        <>
            <Head title={t('Import from Clockify')} />

            <Heading
                variant="small"
                title={t('Import from Clockify')}
                description={t(
                    'Move time entries, clients and projects from a Clockify CSV export into :organization.',
                    { organization: organization.name },
                )}
            />

            {flash.importResult && (
                <ImportResultSummary
                    result={flash.importResult}
                    slug={organization.slug}
                />
            )}

            {preview ? (
                <PreviewStep
                    key={preview.token}
                    slug={organization.slug}
                    preview={preview}
                    memberOptions={memberOptions}
                />
            ) : (
                <UploadStep slug={organization.slug} />
            )}
        </>
    );
}

OrganizationImport.layout = {
    breadcrumbs: [{ title: 'Organizations', href: index() }],
};

function UploadStep({ slug }: { slug: string }) {
    const { t } = useTranslation();
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [isUploading, setUploading] = useState(false);

    const upload = (file: File | undefined) => {
        if (!file) {
            return;
        }

        router.post(
            store.url(slug),
            { file },
            {
                forceFormData: true,
                onStart: () => setUploading(true),
                onFinish: () => setUploading(false),
            },
        );
    };

    return (
        <section className="grid gap-4" data-test="import-upload">
            <ol className="grid list-decimal gap-1 pl-5 text-sm text-muted">
                <li>
                    {t(
                        'In Clockify, export the time as CSV (Reports → Detailed → Export → Save as CSV) or use the user data export.',
                    )}
                </li>
                <li>{t('Upload the file here.')}</li>
                <li>
                    {t(
                        'Check who the time goes to and what is created, then import. Nothing is saved before that.',
                    )}
                </li>
            </ol>

            <DropZone
                onDrop={async (event) => {
                    const item = event.items.find(
                        (dropped) => dropped.kind === 'file',
                    );

                    if (item && item.kind === 'file') {
                        upload(await item.getFile());
                    }
                }}
                className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-separator bg-surface p-8 text-center transition-colors data-[drop-target]:border-accent data-[drop-target]:bg-accent/5"
            >
                <FileUp className="size-8 text-muted" aria-hidden="true" />
                <p className="text-sm text-muted">
                    {t('Drop the CSV file here, or')}
                </p>
                <FileTrigger
                    acceptedFileTypes={['.csv', 'text/csv']}
                    onSelect={(files) => upload(files?.[0])}
                >
                    <Button
                        isPending={isUploading}
                        data-test="import-choose-file"
                    >
                        <Upload className="size-4" />
                        {t('Choose file')}
                    </Button>
                </FileTrigger>
            </DropZone>

            {errors.file && (
                <Alert status="danger" data-test="import-error">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Description>{errors.file}</Alert.Description>
                    </Alert.Content>
                </Alert>
            )}
        </section>
    );
}

function PreviewStep({
    slug,
    preview,
    memberOptions,
}: {
    slug: string;
    preview: ImportPreview;
    memberOptions: SelectOption[];
}) {
    const { t, tc, intlLocale } = useTranslation();
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [members, setMembers] = useState<Record<string, string>>(() =>
        Object.fromEntries(
            preview.members.map((member) => [
                member.email,
                member.memberId === null ? SKIP : String(member.memberId),
            ]),
        ),
    );
    const [billable, setBillable] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(
            preview.projects.map((project) => [project.key, project.billable]),
        ),
    );
    // Rates the importer edited, by "project key|member id" (minor units, null = rate order).
    const [rates, setRates] = useState<Record<string, number | null>>({});
    const [updateExisting, setUpdateExisting] = useState(false);
    const [isImporting, setImporting] = useState(false);
    const hours = (seconds: number) => formatDecimalHours(seconds, intlLocale);
    const params = { organization: slug, import: preview.token };
    const rateUnit = `${
        new Intl.NumberFormat(intlLocale, {
            style: 'currency',
            currency: preview.currency,
            currencyDisplay: 'narrowSymbol',
        })
            .formatToParts(0)
            .find((part) => part.type === 'currency')?.value ?? preview.currency
    }/h`;
    const rateKey = (projectKey: string, memberId: number) =>
        `${projectKey}|${memberId}`;
    const rateOf = (projectKey: string, rate: ImportRate) => {
        const key = rateKey(projectKey, rate.memberId);

        return key in rates ? (rates[key] ?? null) : rate.rate;
    };
    const showsRates = preview.projects.some(
        (project) => billable[project.key] && (project.rates?.length ?? 0) > 0,
    );
    const canRun =
        preview.importable > 0 ||
        (updateExisting && preview.alreadyImported > 0);

    const memberChoices = (next: Record<string, string>) =>
        Object.entries(next).map(([email, member]) => ({ email, member }));

    // Re-plan on the server, so the counts follow the chosen members.
    const chooseMember = (email: string, member: string) => {
        const next = { ...members, [email]: member };
        setMembers(next);
        router.get(
            show.url(params),
            { members: memberChoices(next) },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['preview'],
                // members[0][email]=…, so PHP keeps each email with its member.
                queryStringArrayFormat: 'indices',
            },
        );
    };

    const runImport = () =>
        router.post(
            run.url(params),
            {
                members: memberChoices(members),
                projects: preview.projects
                    .filter((project) => project.isNew)
                    .map((project) => ({
                        key: project.key,
                        billable: billable[project.key] ?? true,
                    })),
                rates: preview.projects
                    .filter((project) => billable[project.key])
                    .flatMap((project) =>
                        (project.rates ?? []).map((rate) => ({
                            project: project.key,
                            member: rate.memberId,
                            rate: rateOf(project.key, rate),
                        })),
                    ),
                update_existing: updateExisting,
            },
            {
                onStart: () => setImporting(true),
                onFinish: () => setImporting(false),
            },
        );

    return (
        <div className="grid grid-cols-1 gap-8" data-test="import-preview">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                    label={t('Rows in the file')}
                    value={String(preview.rows)}
                />
                <Stat
                    label={t('To import')}
                    value={String(preview.importable)}
                    hint={hours(preview.importableSeconds)}
                />
                <Stat
                    label={t('Skipped')}
                    value={String(preview.skippedCount)}
                />
                <Stat
                    label={t('Period')}
                    value={
                        preview.from && preview.to
                            ? `${preview.from} – ${preview.to}`
                            : '–'
                    }
                    small
                />
            </dl>
            <p className="-mt-5 text-sm text-muted">
                {t(
                    'Times are read in :timezone and dates as :format. Entries that already exist are skipped, so the same file can be imported again.',
                    { timezone: preview.timezone, format: preview.dateFormat },
                )}
            </p>

            <section className="grid gap-3">
                <Heading
                    variant="small"
                    title={t('People')}
                    description={t(
                        'Members are matched on email. Choose a member for anyone else, or skip their time.',
                    )}
                />
                <ul className="grid gap-3">
                    {preview.members.map((member) => (
                        <li
                            key={member.email}
                            className="grid gap-3 rounded-2xl bg-surface p-4 shadow-surface sm:grid-cols-[1fr_minmax(0,18rem)] sm:items-end"
                            data-test="import-member"
                        >
                            <div className="min-w-0">
                                <p className="truncate font-medium">
                                    {member.name}
                                </p>
                                <p className="truncate text-sm text-muted">
                                    {member.email} ·{' '}
                                    {tc(
                                        ':count entry|:count entries',
                                        member.entries,
                                        { count: member.entries },
                                    )}{' '}
                                    · {hours(member.seconds)}
                                </p>
                            </div>
                            <SelectField
                                name={`member-${member.email}`}
                                label={t('Time goes to')}
                                options={[
                                    { value: SKIP, label: t('Skip') },
                                    ...memberOptions,
                                ]}
                                value={members[member.email] ?? SKIP}
                                onChange={(value) =>
                                    chooseMember(member.email, value)
                                }
                                className="min-w-0"
                                data-test="import-member-select"
                            />
                        </li>
                    ))}
                </ul>
            </section>

            <section className="grid gap-3">
                <Heading
                    variant="small"
                    title={t('Projects')}
                    description={t(
                        "Projects are matched on client and name. New projects are created as public; choose whether their time is billable and each person's hourly rate.",
                    )}
                />
                {preview.newClients.length > 0 && (
                    <p className="text-sm" data-test="import-new-clients">
                        <span className="font-medium">{t('New clients')}:</span>{' '}
                        {preview.newClients.join(', ')}
                    </p>
                )}
                <ul className="divide-y divide-separator rounded-2xl bg-surface shadow-surface">
                    {preview.projects.map((project) => (
                        <li key={project.key} data-test="import-project">
                            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                                <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-2">
                                        <span className="truncate font-medium">
                                            {project.name}
                                        </span>
                                        {project.isNew ? (
                                            <Chip
                                                size="sm"
                                                color="accent"
                                                variant="soft"
                                            >
                                                {t('New')}
                                            </Chip>
                                        ) : project.isArchived ? (
                                            <Chip
                                                size="sm"
                                                color="warning"
                                                variant="soft"
                                            >
                                                {t('Archived')}
                                            </Chip>
                                        ) : (
                                            <Chip size="sm" variant="soft">
                                                {t('Exists')}
                                            </Chip>
                                        )}
                                    </p>
                                    <p className="truncate text-sm text-muted">
                                        {project.client ?? t('No client')} ·{' '}
                                        {tc(
                                            ':count entry|:count entries',
                                            project.entries,
                                            { count: project.entries },
                                        )}{' '}
                                        · {hours(project.seconds)}
                                    </p>
                                </div>
                                <Switch
                                    isSelected={billable[project.key] ?? false}
                                    isDisabled={!project.isNew}
                                    onChange={(value) =>
                                        setBillable({
                                            ...billable,
                                            [project.key]: value,
                                        })
                                    }
                                    data-test="import-project-billable"
                                >
                                    <Switch.Content>
                                        <Switch.Control>
                                            <Switch.Thumb />
                                        </Switch.Control>
                                        <Label className="text-sm">
                                            {t('Billable')}
                                        </Label>
                                    </Switch.Content>
                                </Switch>
                            </div>
                            {billable[project.key] &&
                                project.rates &&
                                project.rates.length > 0 && (
                                    <div
                                        className="border-t border-separator px-4 pt-2 pb-1"
                                        data-test="import-rates"
                                    >
                                        <p className="flex justify-between text-xs font-medium text-muted">
                                            <span>{t('Person')}</span>
                                            <span>{t('Hourly rate')}</span>
                                        </p>
                                        <ul className="divide-y divide-separator">
                                            {project.rates.map((rate) => (
                                                <ImportRateRow
                                                    key={rate.memberId}
                                                    rate={rate}
                                                    value={rateOf(
                                                        project.key,
                                                        rate,
                                                    )}
                                                    unit={rateUnit}
                                                    onChange={(value) =>
                                                        setRates({
                                                            ...rates,
                                                            [rateKey(
                                                                project.key,
                                                                rate.memberId,
                                                            )]: value,
                                                        })
                                                    }
                                                />
                                            ))}
                                        </ul>
                                    </div>
                                )}
                        </li>
                    ))}
                </ul>
            </section>

            {showsRates && (
                <p className="-mt-5 text-sm text-muted">
                    {t(
                        "An empty rate follows the usual order: the person's rate on the project, the project's rate, the person's rate in the organization, then the organization's default. Changed rates are saved as the person's rate on the project, so time reported later gets the same rate.",
                    )}
                </p>
            )}

            {preview.alreadyImported > 0 && (
                <Checkbox
                    isSelected={updateExisting}
                    onChange={setUpdateExisting}
                    className="items-start rounded-2xl bg-surface p-4 shadow-surface"
                    data-test="import-update-existing"
                >
                    <Checkbox.Content className="items-start">
                        <Checkbox.Control className="mt-0.5">
                            <Checkbox.Indicator />
                        </Checkbox.Control>
                        <span className="grid gap-0.5">
                            <Label className="font-medium">
                                {tc(
                                    'Update the rate and billable setting of :count already imported entry|Update the rate and billable setting of :count already imported entries',
                                    preview.alreadyImported,
                                    { count: preview.alreadyImported },
                                )}
                            </Label>
                            <span className="text-sm text-muted">
                                {t(
                                    'Only entries an earlier import created from the same rows. Time reported in the app is never changed.',
                                )}
                            </span>
                        </span>
                    </Checkbox.Content>
                </Checkbox>
            )}

            {preview.skippedCount > 0 && (
                <section className="grid gap-3">
                    <Heading
                        variant="small"
                        title={t('Skipped rows')}
                        description={t(
                            'These rows are not imported. Fix them in Clockify and import again, or add them by hand.',
                        )}
                    />
                    <ul className="grid gap-1 text-sm">
                        {preview.skippedReasons.map(({ reason, count }) => (
                            <li key={reason} className="flex gap-2">
                                <span className="w-10 shrink-0 text-right font-medium tabular-nums">
                                    {count}
                                </span>
                                <span>{reason}</span>
                            </li>
                        ))}
                    </ul>
                    <SkippedList
                        rows={preview.skipped}
                        total={preview.skippedCount}
                    />
                </section>
            )}

            {errors.import && (
                <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Description>{errors.import}</Alert.Description>
                    </Alert.Content>
                </Alert>
            )}

            <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap justify-end gap-2 border-t border-separator bg-background/90 px-4 py-3 backdrop-blur md:bottom-4 md:mx-0 md:rounded-2xl md:border md:shadow-surface">
                <Button
                    variant="tertiary"
                    onPress={() => router.delete(destroy.url(params))}
                    data-test="import-cancel"
                >
                    {t('Cancel')}
                </Button>
                <Button
                    onPress={runImport}
                    isPending={isImporting}
                    isDisabled={!canRun}
                    data-test="import-run"
                >
                    {preview.importable === 0 && preview.alreadyImported > 0
                        ? tc(
                              'Update :count entry|Update :count entries',
                              preview.alreadyImported,
                              { count: preview.alreadyImported },
                          )
                        : tc(
                              'Import :count entry|Import :count entries',
                              preview.importable,
                              { count: preview.importable },
                          )}
                </Button>
            </div>
        </div>
    );
}

function ImportResultSummary({
    result,
    slug,
}: {
    result: ImportResult;
    slug: string;
}) {
    const { t, tc, intlLocale } = useTranslation();

    return (
        <section className="grid gap-3" data-test="import-result">
            <Alert status="success">
                <Alert.Indicator />
                <Alert.Content>
                    <Alert.Title>
                        {result.created === 0 && result.updated > 0
                            ? tc(
                                  ':count entry updated.|:count entries updated.',
                                  result.updated,
                                  { count: result.updated },
                              )
                            : `${tc(
                                  ':count entry imported.|:count entries imported.',
                                  result.created,
                                  { count: result.created },
                              )} (${formatDecimalHours(result.seconds, intlLocale)})`}
                    </Alert.Title>
                    <Alert.Description>
                        {result.created > 0 &&
                            result.updated > 0 &&
                            `${tc(
                                ':count entry updated.|:count entries updated.',
                                result.updated,
                                { count: result.updated },
                            )} `}
                        {t(':clients new clients and :projects new projects.', {
                            clients: result.clientsCreated,
                            projects: result.projectsCreated,
                        })}{' '}
                        {result.from && result.to && (
                            <Link
                                href={reportSummary(slug, {
                                    query: {
                                        period: 'custom',
                                        from: result.from,
                                        to: result.to,
                                        group: 'project',
                                        subgroup: 'member',
                                    },
                                })}
                                className="font-medium underline"
                            >
                                {t('See the report for the period')}
                            </Link>
                        )}
                    </Alert.Description>
                </Alert.Content>
            </Alert>
            {result.skippedCount > 0 && (
                <SkippedList
                    rows={result.skipped}
                    total={result.skippedCount}
                />
            )}
            <p className="text-sm">
                <Link href={edit(slug)} className="text-accent underline">
                    {t('Back to the organization')}
                </Link>
            </p>
        </section>
    );
}

/**
 * A member with time on a billable project and their hourly rate, prefilled from the rate order.
 * A changed rate is saved as the member's rate on the project.
 */
function ImportRateRow({
    rate,
    value,
    unit,
    onChange,
}: {
    rate: ImportRate;
    value: number | null;
    unit: string;
    onChange: (value: number | null) => void;
}) {
    const { t, tc, intlLocale } = useTranslation();
    const getInitials = useInitials();
    const isChanged = value !== null && value !== rate.defaultRate;

    return (
        <li className="flex items-center gap-3 py-2" data-test="import-rate">
            <Avatar size="sm" className="shrink-0">
                {rate.avatar && <Avatar.Image src={rate.avatar} alt="" />}
                <Avatar.Fallback>{getInitials(rate.name)}</Avatar.Fallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{rate.name}</p>
                <p className="truncate text-xs text-muted">
                    {tc(':count entry|:count entries', rate.entries, {
                        count: rate.entries,
                    })}{' '}
                    · {formatDecimalHours(rate.seconds, intlLocale)}
                </p>
            </div>
            <div className="grid justify-items-end gap-1">
                <NumberField
                    aria-label={t('Hourly rate for :name', {
                        name: rate.name,
                    })}
                    value={value === null ? Number.NaN : value / 100}
                    onChange={(next) =>
                        onChange(Number.isNaN(next) ? null : toMinorUnits(next))
                    }
                    minValue={0}
                    formatOptions={{ maximumFractionDigits: 2 }}
                    className="w-36"
                    data-test="import-rate-input"
                >
                    {/* A row, so the unit sits after the number. */}
                    <NumberField.Group className="flex items-center">
                        <NumberField.Input
                            placeholder="–"
                            className="min-w-0 flex-1 text-right"
                        />
                        <span
                            aria-hidden="true"
                            className="shrink-0 pe-3 text-sm text-muted"
                        >
                            {unit}
                        </span>
                    </NumberField.Group>
                </NumberField>
                {isChanged && (
                    <span className="text-xs text-accent-soft-foreground">
                        {t('Saved as the rate on the project')}
                    </span>
                )}
            </div>
        </li>
    );
}

function SkippedList({
    rows,
    total,
}: {
    rows: SkippedImportRow[];
    total: number;
}) {
    const { t, tc } = useTranslation();

    return (
        <details className="rounded-2xl bg-surface p-4 text-sm shadow-surface">
            <summary className="cursor-pointer font-medium">
                {tc('Show :count skipped row|Show :count skipped rows', total, {
                    count: total,
                })}
            </summary>
            <ul className="mt-3 grid gap-2" data-test="import-skipped">
                {rows.map((row) => (
                    <li key={`${row.line}-${row.reason}`} className="grid">
                        <span className="text-muted tabular-nums">
                            {t('Line :line', { line: row.line })}
                            {row.date && ` · ${row.date}`}
                            {row.user && ` · ${row.user}`}
                            {row.project && ` · ${row.project}`}
                        </span>
                        <span>{row.reason}</span>
                    </li>
                ))}
                {total > rows.length && (
                    <li className="text-muted">
                        {t('… and :count more.', {
                            count: total - rows.length,
                        })}
                    </li>
                )}
            </ul>
        </details>
    );
}

function Stat({
    label,
    value,
    hint,
    small = false,
}: {
    label: string;
    value: string;
    hint?: string;
    small?: boolean;
}) {
    return (
        <div className="grid content-start gap-1 rounded-2xl bg-surface p-4 shadow-surface">
            <dt className="text-sm text-muted">{label}</dt>
            <dd
                className={
                    small ? 'text-sm font-semibold' : 'text-xl font-semibold'
                }
            >
                {value}
            </dd>
            {hint && <dd className="text-xs text-muted">{hint}</dd>}
        </div>
    );
}
