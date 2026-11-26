import { Button, ListBox, SearchField } from '@heroui/react';
import { Link, router } from '@inertiajs/react';
import {
    FolderKanban,
    ListFilter,
    Lock,
    Plus,
    SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MobilePageHeader } from '@/components/app-shell/mobile-page-header';
import { EstimateProgress } from '@/components/estimate-progress';
import { LogoImage } from '@/components/logo-image';
import { ProjectDot } from '@/components/project-dot';
import { SegmentedControl } from '@/components/segmented-control';
import {
    SideDrawer,
    SideDrawerBody,
    SideDrawerFooter,
} from '@/components/side-drawer';
import { formatHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { index, show } from '@/routes/projects';
import type { ProjectListItem } from '@/types';

export type ProjectListFilters = {
    search: string;
    status: 'active' | 'archived';
    client: number | null;
    billable: '1' | '0' | null;
};

export type ProjectFilterClient = {
    id: number;
    name: string;
    logo: string | null;
};

type Props = {
    projects: ProjectListItem[];
    filters: ProjectListFilters;
    clients: ProjectFilterClient[];
    onCreate?: () => void;
    hasTimer: boolean;
};

const defaultFilters: ProjectListFilters = {
    search: '',
    status: 'active',
    client: null,
    billable: null,
};

const billingLabels = {
    all: 'All',
    '1': 'Billable (plural)',
    '0': 'Non-billable (plural)',
} as const;

const headerButtonClass =
    'relative grid size-[34px] min-w-0 shrink-0 place-items-center overflow-visible rounded-full p-0 before:absolute before:-inset-y-1.5 before:-inset-x-[5px] before:content-[""]';
const searchGroupClass =
    'h-10 border-transparent bg-background shadow-[inset_0_1px_3px_#0000000d]';
const segmentsClass =
    'w-full p-[3px] [&>button]:h-8 [&>button]:min-w-0 [&>button]:flex-1 [&>button]:px-1 [&>button]:font-normal [&>button]:text-muted [&>button[data-selected=true]]:font-medium [&>button[data-selected=true]]:text-foreground';

export function MobileProjects({
    projects,
    filters,
    clients,
    onCreate,
    hasTimer,
}: Props) {
    const { t, tc } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [clientSearch, setClientSearch] = useState('');
    const [draftSearch, setDraftSearch] = useState<string | null>(null);
    const [pending, setPending] = useState<ProjectListFilters | null>(null);
    const searchTimer = useRef<number | undefined>(undefined);
    const current = pending ?? filters;
    const search = draftSearch ?? current.search;

    useEffect(() => () => window.clearTimeout(searchTimer.current), []);

    const apply = (changes: Partial<ProjectListFilters>) => {
        window.clearTimeout(searchTimer.current);
        setDraftSearch(null);
        const next = { ...current, search, ...changes };
        const query = Object.fromEntries(
            Object.entries(next).filter(
                ([key, value]) =>
                    value !== defaultFilters[key as keyof ProjectListFilters],
            ),
        );

        setPending(next);
        router.get(index.url(), query, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onFinish: () =>
                setPending((value) => (value === next ? null : value)),
        });
    };

    const changeSearch = (value: string) => {
        setDraftSearch(value);
        window.clearTimeout(searchTimer.current);
        searchTimer.current = window.setTimeout(
            () => apply({ search: value.trim() }),
            300,
        );
    };

    const closeFilters = (open: boolean) => {
        if (!open) {
            setClientSearch('');
            if (draftSearch !== null) {
                apply({ search: draftSearch.trim() });
            }
        }

        setIsOpen(open);
    };

    const activeLabels = [
        current.status === 'archived' && t('Archived (plural)'),
        current.client !== null &&
            (clients.find(({ id }) => id === current.client)?.name ??
                t('Client')),
        current.billable !== null && t(billingLabels[current.billable]),
        current.search && `“${current.search}”`,
    ].filter(Boolean);
    const activeCount = activeLabels.length;
    const isNarrowed = Boolean(
        current.search || current.client !== null || current.billable !== null,
    );
    const clearFilters = () => {
        setClientSearch('');
        apply(defaultFilters);
    };
    const clientQuery = clientSearch.trim().toLocaleLowerCase();
    const visibleClients = clients.filter(({ name }) =>
        name.toLocaleLowerCase().includes(clientQuery),
    );

    return (
        <>
            <div
                className="flex min-h-[calc(100svh-var(--mobile-tab-bar-height)-var(--project-timer-space))] flex-col"
                style={
                    {
                        '--project-timer-space': hasTimer
                            ? 'var(--mobile-timer-space)'
                            : '0px',
                    } as React.CSSProperties
                }
            >
                <MobilePageHeader className="flex items-center justify-between">
                    <div className="min-w-0">
                        <h1 className="text-[17px]/[21px] font-semibold">
                            {t('Projects')}
                        </h1>
                        {activeCount > 0 && (
                            <p className="truncate text-xs text-muted">
                                {activeLabels.join(' · ')}
                            </p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button
                            isIconOnly
                            variant="outline"
                            aria-label={
                                activeCount
                                    ? tc(
                                          'Filters, :count selected',
                                          activeCount,
                                      )
                                    : t('Filters')
                            }
                            aria-haspopup="dialog"
                            aria-expanded={isOpen}
                            className={cn(
                                headerButtonClass,
                                activeCount
                                    ? 'border-accent/35 bg-accent/10 text-accent'
                                    : 'border-border bg-surface text-foreground',
                            )}
                            onPress={() => setIsOpen(true)}
                            data-test="mobile-project-filters"
                        >
                            <SlidersHorizontal
                                aria-hidden="true"
                                className="size-[18px]"
                            />
                            {activeCount > 0 && (
                                <span
                                    aria-hidden="true"
                                    className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-accent"
                                />
                            )}
                        </Button>
                        {onCreate && (
                            <Button
                                isIconOnly
                                aria-label={t('New project')}
                                aria-haspopup="dialog"
                                className={cn(
                                    headerButtonClass,
                                    'bg-accent text-accent-foreground shadow-sm',
                                )}
                                onPress={onCreate}
                                data-test="new-project-button"
                            >
                                <Plus
                                    aria-hidden="true"
                                    className="size-[18px]"
                                />
                            </Button>
                        )}
                    </div>
                </MobilePageHeader>

                {projects.length > 0 ? (
                    <ul>
                        {projects.map((project) => (
                            <MobileProjectRow
                                key={project.id}
                                project={project}
                            />
                        ))}
                    </ul>
                ) : (
                    <div className="grid flex-1 place-content-center justify-items-center px-4 py-10 text-center">
                        <span className="mb-4 grid size-[52px] place-items-center rounded-full bg-default text-muted">
                            <FolderKanban
                                aria-hidden="true"
                                className="size-6"
                            />
                        </span>
                        <p className="text-[15px] font-medium">
                            {isNarrowed
                                ? t('No projects match your search.')
                                : current.status === 'archived'
                                  ? t('No archived projects.')
                                  : t('No projects yet.')}
                        </p>
                        {isNarrowed ? (
                            <Button
                                variant="ghost"
                                className="text-accent"
                                onPress={clearFilters}
                            >
                                {t('Clear filters')}
                            </Button>
                        ) : (
                            current.status === 'active' &&
                            onCreate && (
                                <p className="mt-1.5 text-[13px] text-muted">
                                    {t('Create the first one with +.')}
                                </p>
                            )
                        )}
                    </div>
                )}
            </div>

            <SideDrawer
                title={t('Filters')}
                isOpen={isOpen}
                onOpenChange={closeFilters}
                headerActions={
                    activeCount > 0 && (
                        <Button
                            variant="ghost"
                            className="h-8 px-0 text-accent"
                            onPress={clearFilters}
                        >
                            {t('Clear')}
                        </Button>
                    )
                }
            >
                <SideDrawerBody>
                    <div className="grid gap-4">
                        <SearchField
                            aria-label={t('Search projects')}
                            value={search}
                            onChange={changeSearch}
                        >
                            <SearchField.Group className={searchGroupClass}>
                                <SearchField.SearchIcon />
                                <SearchField.Input
                                    placeholder={t('Search projects')}
                                />
                                <SearchField.ClearButton />
                            </SearchField.Group>
                        </SearchField>
                        <div className="grid gap-1.5">
                            <span className="text-[13px] text-muted">
                                {t('Status')}
                            </span>
                            <SegmentedControl
                                aria-label={t('Status')}
                                className={segmentsClass}
                                value={current.status}
                                onChange={(status) => apply({ status })}
                                options={[
                                    {
                                        id: 'active',
                                        label: t('Active (plural)'),
                                    },
                                    {
                                        id: 'archived',
                                        label: t('Archived (plural)'),
                                    },
                                ]}
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <span className="text-[13px] text-muted">
                                {t('Billing')}
                            </span>
                            <SegmentedControl
                                aria-label={t('Billing')}
                                className={segmentsClass}
                                value={current.billable ?? 'all'}
                                onChange={(value) =>
                                    apply({
                                        billable:
                                            value === 'all' ? null : value,
                                    })
                                }
                                options={[
                                    { id: 'all', label: t(billingLabels.all) },
                                    { id: '1', label: t(billingLabels['1']) },
                                    { id: '0', label: t(billingLabels['0']) },
                                ]}
                            />
                        </div>
                        {clients.length > 0 && (
                            <div className="grid gap-1.5">
                                <span className="text-[13px] text-muted">
                                    {t('Client')}
                                </span>
                                {clients.length > 7 && (
                                    <SearchField
                                        aria-label={t('Search clients')}
                                        value={clientSearch}
                                        onChange={setClientSearch}
                                    >
                                        <SearchField.Group
                                            className={searchGroupClass}
                                        >
                                            <SearchField.SearchIcon />
                                            <SearchField.Input
                                                placeholder={t(
                                                    'Search clients',
                                                )}
                                            />
                                            <SearchField.ClearButton />
                                        </SearchField.Group>
                                    </SearchField>
                                )}
                                <ListBox
                                    aria-label={t('Client')}
                                    className={cn(
                                        'gap-0 p-0',
                                        clients.length > 7 &&
                                            'scroll-fade-y max-h-56 overflow-y-auto',
                                    )}
                                    selectionMode="single"
                                    disallowEmptySelection
                                    selectedKeys={[current.client ?? 'all']}
                                    onSelectionChange={(keys) => {
                                        if (keys === 'all') return;
                                        const [id] = keys;
                                        if (id !== undefined)
                                            apply({
                                                client:
                                                    id === 'all'
                                                        ? null
                                                        : Number(id),
                                            });
                                    }}
                                >
                                    <ListBox.Item
                                        id="all"
                                        textValue={t('All clients')}
                                        className="min-h-11 gap-3 px-0 text-[15px] data-[selected=true]:font-medium"
                                    >
                                        <span className="grid size-6 place-items-center text-muted">
                                            <ListFilter
                                                aria-hidden="true"
                                                className="size-4"
                                            />
                                        </span>
                                        <span className="min-w-0 flex-1 truncate">
                                            {t('All clients')}
                                        </span>
                                        <ListBox.ItemIndicator className="text-accent" />
                                    </ListBox.Item>
                                    {visibleClients.map((client) => (
                                        <ListBox.Item
                                            key={client.id}
                                            id={client.id}
                                            textValue={client.name}
                                            className="min-h-11 gap-3 px-0 text-[15px] data-[selected=true]:font-medium"
                                        >
                                            <LogoImage
                                                src={client.logo}
                                                name={client.name}
                                                size={24}
                                                className="rounded-md"
                                            />
                                            <span className="min-w-0 flex-1 truncate">
                                                {client.name}
                                            </span>
                                            <ListBox.ItemIndicator className="text-accent" />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </div>
                        )}
                    </div>
                </SideDrawerBody>
                <SideDrawerFooter>
                    <Button slot="close" className="w-full">
                        {tc(
                            'Show :count project|Show :count projects',
                            projects.length,
                        )}
                    </Button>
                </SideDrawerFooter>
            </SideDrawer>
        </>
    );
}

function MobileProjectRow({ project }: { project: ProjectListItem }) {
    const { t, intlLocale } = useTranslation();

    return (
        <li
            className="relative not-last:after:pointer-events-none not-last:after:absolute not-last:after:right-0 not-last:after:bottom-0 not-last:after:left-9 not-last:after:border-b not-last:after:border-separator not-last:after:content-['']"
            data-test="project-row"
        >
            <Link
                href={show({ project: project.slug })}
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 px-4 py-3 transition-colors active:bg-default"
            >
                <span className="flex h-5 items-center">
                    <ProjectDot color={project.color} size="compact" />
                </span>
                <div className="min-w-0">
                    <div className="flex justify-between gap-3 text-[15px]/5 font-medium">
                        <p className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate">{project.name}</span>
                            {project.isPrivate && (
                                <>
                                    <Lock
                                        aria-hidden="true"
                                        className="size-3.5 shrink-0 text-muted"
                                    />
                                    <span className="sr-only">
                                        {t('Private')}
                                    </span>
                                </>
                            )}
                        </p>
                        <span className="shrink-0 whitespace-nowrap tabular-nums">
                            <span className="sr-only">{t('Reported')} </span>
                            {formatHours(project.consumedSeconds, intlLocale)}
                        </span>
                    </div>
                    <p className="mt-0.5 truncate text-[13px]/[18px] text-muted">
                        {[project.client?.name ?? t('No client'), project.code]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                    {project.estimateSeconds ? (
                        <div className="mt-1">
                            <EstimateProgress
                                consumedSeconds={project.consumedSeconds}
                                estimateSeconds={project.estimateSeconds}
                                display="inline-budget"
                            />
                        </div>
                    ) : null}
                </div>
            </Link>
        </li>
    );
}
