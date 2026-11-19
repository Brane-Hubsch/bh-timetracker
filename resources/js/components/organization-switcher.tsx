import { Button, Dropdown, Header, Label, Separator } from '@heroui/react';
import { usePage } from '@inertiajs/react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useState } from 'react';
import CreateOrganizationModal from '@/components/create-organization-modal';
import { useSwitchOrganization } from '@/hooks/use-switch-organization';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
    className?: string;
    compact?: boolean;
};

/**
 * Shows and switches the active organization (see useSwitchOrganization).
 */
export function OrganizationSwitcher({ className, compact = false }: Props) {
    const { t } = useTranslation();
    const { currentOrganization, organizations } = usePage().props;
    const [isCreateOpen, setCreateOpen] = useState(false);

    const switchOrganization = useSwitchOrganization();

    const onAction = (key: React.Key) => {
        if (key === 'create') {
            setCreateOpen(true);

            return;
        }

        const organization = organizations.find(
            (candidate) => String(candidate.id) === String(key),
        );

        if (organization && organization.id !== currentOrganization?.id) {
            switchOrganization(organization);
        }
    };

    return (
        <>
            <Dropdown>
                <Button
                    variant="ghost"
                    size={compact ? 'sm' : 'md'}
                    className={cn(
                        'justify-between gap-2',
                        compact ? 'max-w-40' : 'w-full',
                        className,
                    )}
                    data-test="organization-switcher-trigger"
                >
                    <span className="truncate font-medium">
                        {currentOrganization?.name ?? t('Select organization')}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 text-muted" />
                </Button>
                <Dropdown.Popover placement="bottom start" className="min-w-56">
                    <Dropdown.Menu onAction={onAction}>
                        <Dropdown.Section>
                            <Header>{t('Organizations')}</Header>
                            {organizations.map((organization) => (
                                <Dropdown.Item
                                    key={organization.id}
                                    id={String(organization.id)}
                                    textValue={organization.name}
                                    data-test="organization-switcher-item"
                                >
                                    <Label>{organization.name}</Label>
                                    {organization.id ===
                                        currentOrganization?.id && (
                                        <Check className="ml-auto size-4" />
                                    )}
                                </Dropdown.Item>
                            ))}
                        </Dropdown.Section>
                        <Separator />
                        <Dropdown.Item
                            id="create"
                            textValue={t('New organization')}
                            data-test="organization-switcher-new-organization"
                        >
                            <Plus className="size-4" />
                            <Label>{t('New organization')}</Label>
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown.Popover>
            </Dropdown>

            <CreateOrganizationModal
                isOpen={isCreateOpen}
                onOpenChange={setCreateOpen}
            />
        </>
    );
}
