import { Button, Chip } from '@heroui/react';
import { Head, Link } from '@inertiajs/react';
import { Briefcase, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { LogoImage } from '@/components/logo-image';
import { ClientFormDrawer } from '@/components/client-form-drawer';
import Heading from '@/components/heading';
import { ListFilters } from '@/components/list-filters';
import { useOpenFromQuery } from '@/hooks/use-open-from-query';
import { useTranslation } from '@/lib/i18n';
import { show } from '@/routes/clients';
import type { ClientListItem } from '@/types';

type Props = {
    clients: ClientListItem[];
    filters: { search: string; status: 'active' | 'archived' };
};

export default function ClientsIndex({ clients, filters }: Props) {
    const { t, tc } = useTranslation();
    const [isCreateOpen, setCreateOpen] = useState(false);
    useOpenFromQuery('new', () => setCreateOpen(true));

    return (
        <>
            <Head title={t('Clients')} />

            <div className="grid gap-6">
                <Heading
                    title={t('Clients')}
                    actions={
                        <Button
                            onPress={() => setCreateOpen(true)}
                            data-test="new-client-button"
                        >
                            <Plus className="size-4" />
                            {t('New client')}
                        </Button>
                    }
                />

                <ListFilters filters={filters} />

                <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface shadow-surface">
                    {clients.map((client) => (
                        <li key={client.id} data-test="client-row">
                            <Link
                                href={show({ client: client.slug })}
                                className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-secondary"
                            >
                                <LogoImage
                                    src={client.logo}
                                    name={client.name}
                                    size={40}
                                />
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate font-medium">
                                            {client.name}
                                        </span>
                                        {client.isArchived && (
                                            <Chip size="sm" variant="soft">
                                                {t('Archived')}
                                            </Chip>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted">
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
                                <ChevronRight className="size-4 shrink-0 text-muted" />
                            </Link>
                        </li>
                    ))}
                    {clients.length === 0 && (
                        <li className="grid justify-items-center gap-2 p-10 text-center">
                            <Briefcase className="size-6 text-muted" />
                            <p className="text-sm text-muted">
                                {filters.search
                                    ? t('No clients match your search.')
                                    : filters.status === 'archived'
                                      ? t('No archived clients.')
                                      : t('No clients yet.')}
                            </p>
                        </li>
                    )}
                </ul>
            </div>

            <ClientFormDrawer
                client={null}
                isOpen={isCreateOpen}
                onOpenChange={setCreateOpen}
            />
        </>
    );
}
