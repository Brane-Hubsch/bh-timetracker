import { Button, Chip } from '@heroui/react';
import { Head, Link, usePage } from '@inertiajs/react';
import { Briefcase, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { ClientFormDrawer } from '@/components/client-form-drawer';
import Heading from '@/components/heading';
import { ListFilters } from '@/components/list-filters';
import { LogoImage } from '@/components/logo-image';
import { MobileListFilters } from '@/components/mobile-list-filters';
import { MobileListHeader } from '@/components/mobile-list-header';
import { useIsDesktop } from '@/hooks/use-media-query';
import {
    defaultSearchStatus,
    useMobileListFilters,
    type SearchStatusFilters,
} from '@/hooks/use-mobile-list-filters';
import { useOpenFromQuery } from '@/hooks/use-open-from-query';
import { useTranslation } from '@/lib/i18n';
import { index, show } from '@/routes/clients';
import type { ClientListItem, ClientNameOption } from '@/types';

type Props = {
    clients: ClientListItem[];
    clientNameOptions: ClientNameOption[];
    filters: SearchStatusFilters;
};

export default function ClientsIndex({
    clients,
    clientNameOptions,
    filters,
}: Props) {
    const { t, tc } = useTranslation();
    const isDesktop = useIsDesktop();
    const { currentOrganization } = usePage().props;
    const [isCreateOpen, setCreateOpen] = useState(false);
    useOpenFromQuery('new', () => setCreateOpen(true));
    const { current, search, isOpen, changeOpen, apply, changeSearch } =
        useMobileListFilters(
            index.url(currentOrganization?.slug),
            filters,
            defaultSearchStatus,
        );
    const filterLabels = current.search ? [`“${current.search}”`] : [];
    const filterCount =
        filterLabels.length + Number(current.status === 'archived');
    const clearFilters = () => apply(defaultSearchStatus);
    const openCreate = () => setCreateOpen(true);
    const emptyLabel = filters.search
        ? t('No clients match your search.')
        : filters.status === 'archived'
          ? t('No archived clients.')
          : t('No clients yet.');

    return (
        <>
            <Head title={t('Clients')} />

            <div className="flex flex-col max-md:min-h-full md:grid md:gap-6">
                {isDesktop ? (
                    <>
                        <Heading
                            title={t('Clients')}
                            actions={
                                <Button
                                    onPress={openCreate}
                                    data-test="new-client-button"
                                >
                                    <Plus className="size-4" />
                                    {t('New client')}
                                </Button>
                            }
                        />
                        <ListFilters filters={filters} />
                    </>
                ) : (
                    <MobileListHeader
                        title={t('Clients')}
                        filterLabels={filterLabels}
                        filterCount={filterCount}
                        filtersOpen={isOpen}
                        onOpenFilters={() => changeOpen(true)}
                        filterTestId="mobile-client-filters"
                        createAction={{
                            label: t('New client'),
                            onPress: openCreate,
                            testId: 'new-client-button',
                        }}
                    />
                )}

                <ul className="max-md:flex max-md:flex-1 max-md:flex-col md:divide-y md:divide-separator md:overflow-hidden md:rounded-2xl md:bg-surface md:shadow-surface">
                    {clients.map((client) => (
                        <li
                            key={client.id}
                            className="max-md:relative max-md:not-last:after:pointer-events-none max-md:not-last:after:absolute max-md:not-last:after:inset-s-[68px] max-md:not-last:after:inset-e-0 max-md:not-last:after:bottom-0 max-md:not-last:after:border-b max-md:not-last:after:border-separator max-md:not-last:after:content-['']"
                            data-test="client-row"
                        >
                            <Link
                                href={show({ client: client.slug })}
                                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors max-md:active:bg-default md:gap-4 md:py-4 md:hover:bg-surface-secondary"
                            >
                                <LogoImage
                                    src={client.logo}
                                    name={client.name}
                                    size={40}
                                />
                                <div className="min-w-0 flex-1 space-y-0.5 md:space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate font-medium max-md:text-[15px]/5">
                                            {client.name}
                                        </span>
                                        {isDesktop && client.isArchived && (
                                            <Chip size="sm" variant="soft">
                                                {t('Archived')}
                                            </Chip>
                                        )}
                                    </div>
                                    <p className="text-muted max-md:text-[13px]/[18px] md:text-sm">
                                        {client.organizationNumber &&
                                            `${client.organizationNumber} · `}
                                        <span className="inline-block">
                                            {tc(
                                                ':count active project|:count active projects',
                                                client.activeProjectsCount,
                                            )}
                                            {' · '}
                                            {tc(
                                                ':count archived',
                                                client.archivedProjectsCount,
                                            )}
                                        </span>
                                    </p>
                                </div>
                                <ChevronRight className="hidden size-4 shrink-0 text-muted md:block" />
                            </Link>
                        </li>
                    ))}
                    {clients.length === 0 && (
                        <li className="grid justify-items-center py-10 text-center max-md:flex-1 max-md:place-content-center max-md:px-4 md:gap-2 md:px-10">
                            <span className="grid place-items-center text-muted max-md:mb-4 max-md:size-[52px] max-md:rounded-full max-md:bg-default">
                                <Briefcase
                                    aria-hidden="true"
                                    className="size-6"
                                />
                            </span>
                            <p className="text-[15px] font-medium md:text-sm md:font-normal md:text-muted">
                                {emptyLabel}
                            </p>
                            {!isDesktop &&
                                (filters.search ? (
                                    <Button
                                        variant="ghost"
                                        className="text-accent"
                                        onPress={clearFilters}
                                    >
                                        {t('Clear filters')}
                                    </Button>
                                ) : (
                                    filters.status === 'active' && (
                                        <p className="mt-1.5 text-[13px] text-muted">
                                            {t(
                                                'Create the first client with +.',
                                            )}
                                        </p>
                                    )
                                ))}
                        </li>
                    )}
                </ul>
            </div>

            {!isDesktop && (
                <MobileListFilters
                    isOpen={isOpen}
                    onOpenChange={changeOpen}
                    hasFilters={filterCount > 0}
                    onClear={clearFilters}
                    searchLabel={t('Search clients')}
                    search={search}
                    onSearchChange={changeSearch}
                    status={current.status}
                    onStatusChange={(status) => apply({ status })}
                    doneLabel={tc(
                        'Show :count client|Show :count clients',
                        clients.length,
                    )}
                />
            )}

            <ClientFormDrawer
                client={null}
                clientNameOptions={clientNameOptions}
                isOpen={isCreateOpen}
                onOpenChange={setCreateOpen}
            />
        </>
    );
}
