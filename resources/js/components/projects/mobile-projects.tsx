import { Button, ListBox } from '@heroui/react';
import { FolderKanban, ListFilter, Lock } from 'lucide-react';
import { useState } from 'react';
import { LogoImage } from '@/components/logo-image';
import {
    MobileFilterSearch,
    MobileListFilters,
    mobileFilterSegmentsClass,
} from '@/components/mobile-list-filters';
import { MobileListHeader } from '@/components/mobile-list-header';
import { MobileProjectRow } from '@/components/projects/mobile-project-row';
import { SegmentedControl } from '@/components/segmented-control';
import {
    defaultSearchStatus,
    useMobileListFilters,
    type SearchStatusFilters,
} from '@/hooks/use-mobile-list-filters';
import { formatHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { index } from '@/routes/projects';
import type { ProjectListItem } from '@/types';

export type ProjectListFilters = SearchStatusFilters & {
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
    ...defaultSearchStatus,
    client: null,
    billable: null,
};

const billingLabels = {
    all: 'All',
    '1': 'Billable (plural)',
    '0': 'Non-billable (plural)',
} as const;

export function MobileProjects({
    projects,
    filters,
    clients,
    onCreate,
    hasTimer,
}: Props) {
    const { t, tc } = useTranslation();
    const [clientSearch, setClientSearch] = useState('');
    const { current, search, isOpen, changeOpen, apply, changeSearch } =
        useMobileListFilters(index.url(), filters, defaultFilters);

    const closeFilters = (open: boolean) => {
        if (!open) setClientSearch('');
        changeOpen(open);
    };

    const activeLabels = [
        current.status === 'archived' && t('Archived (plural)'),
        current.client !== null &&
            (clients.find(({ id }) => id === current.client)?.name ??
                t('Client')),
        current.billable !== null && t(billingLabels[current.billable]),
        current.search && `“${current.search}”`,
    ].filter((label): label is string => Boolean(label));
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
                <MobileListHeader
                    title={t('Projects')}
                    filterLabels={activeLabels}
                    filtersOpen={isOpen}
                    onOpenFilters={() => changeOpen(true)}
                    filterTestId="mobile-project-filters"
                    createAction={
                        onCreate && {
                            label: t('New project'),
                            onPress: onCreate,
                            testId: 'new-project-button',
                        }
                    }
                />

                {projects.length > 0 ? (
                    <ul>
                        {projects.map((project) => (
                            <ProjectListRow
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

            <MobileListFilters
                isOpen={isOpen}
                onOpenChange={closeFilters}
                hasFilters={activeLabels.length > 0}
                onClear={clearFilters}
                searchLabel={t('Search projects')}
                search={search}
                onSearchChange={changeSearch}
                status={current.status}
                onStatusChange={(status) => apply({ status })}
                doneLabel={tc(
                    'Show :count project|Show :count projects',
                    projects.length,
                )}
            >
                <div className="grid gap-1.5">
                    <span className="text-[13px] text-muted">
                        {t('Billing')}
                    </span>
                    <SegmentedControl
                        aria-label={t('Billing')}
                        className={mobileFilterSegmentsClass}
                        value={current.billable ?? 'all'}
                        onChange={(value) =>
                            apply({
                                billable: value === 'all' ? null : value,
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
                            <MobileFilterSearch
                                label={t('Search clients')}
                                value={clientSearch}
                                onChange={setClientSearch}
                            />
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
                                            id === 'all' ? null : Number(id),
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
            </MobileListFilters>
        </>
    );
}

function ProjectListRow({ project }: { project: ProjectListItem }) {
    const { t, intlLocale } = useTranslation();

    return (
        <MobileProjectRow
            project={project}
            testId="project-row"
            subtitle={[project.client?.name ?? t('No client'), project.code]
                .filter(Boolean)
                .join(' · ')}
            nameAccessory={
                project.isPrivate && (
                    <>
                        <Lock
                            aria-hidden="true"
                            className="size-3.5 shrink-0 text-muted"
                        />
                        <span className="sr-only">{t('Private')}</span>
                    </>
                )
            }
            trailing={
                <span className="shrink-0 whitespace-nowrap tabular-nums">
                    <span className="sr-only">{t('Reported')} </span>
                    {formatHours(project.consumedSeconds, intlLocale)}
                </span>
            }
        />
    );
}
