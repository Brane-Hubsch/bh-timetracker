import { Button, Chip, buttonVariants } from '@heroui/react';
import { Head, Link, router } from '@inertiajs/react';
import { LogOut, Plus } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import CreateOrganizationModal from '@/components/create-organization-modal';
import Heading from '@/components/heading';
import { LogoImage } from '@/components/logo-image';
import { useOverlayData } from '@/hooks/use-overlay-data';
import { useTranslation } from '@/lib/i18n';
import { edit, index, leave } from '@/routes/organizations';
import type { Organization } from '@/types';

type Props = {
    organizations: Organization[];
};

export default function OrganizationsIndex({ organizations }: Props) {
    const { t } = useTranslation();
    const [isCreateOpen, setCreateOpen] = useState(false);
    const [leaving, setLeaving] = useState<Organization | null>(null);
    const leaveTarget = useOverlayData(leaving);
    const [isProcessing, setProcessing] = useState(false);

    const leaveOrganization = () => {
        if (!leaving) {
            return;
        }

        router.visit(leave(leaving.slug), {
            onStart: () => setProcessing(true),
            onFinish: () => {
                setProcessing(false);
                setLeaving(null);
            },
        });
    };

    return (
        <>
            <Head title={t('Organizations')} />

            <Heading
                variant="small"
                title={t('Organizations')}
                description={t('The organizations you belong to.')}
                actions={
                    <Button
                        variant="secondary"
                        onPress={() => setCreateOpen(true)}
                        data-test="organizations-new-organization-button"
                    >
                        <Plus className="size-4" />
                        {t('New organization')}
                    </Button>
                }
            />

            <ul className="divide-y divide-separator rounded-2xl bg-surface shadow-surface">
                {organizations.map((organization) => (
                    <li
                        key={organization.id}
                        data-test="organization-row"
                        className="flex items-center justify-between gap-4 p-4"
                    >
                        <LogoImage
                            src={organization.logo}
                            name={organization.name}
                            size={40}
                            fit="cover"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                                <span className="truncate font-medium">
                                    {organization.name}
                                </span>
                                {organization.isCurrent && (
                                    <Chip
                                        size="sm"
                                        color="accent"
                                        variant="soft"
                                    >
                                        {t('Active')}
                                    </Chip>
                                )}
                            </div>
                            <span className="text-sm text-muted">
                                {organization.roleLabel}
                            </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            {organization.role !== 'owner' && (
                                <Button
                                    isIconOnly
                                    variant="ghost"
                                    size="sm"
                                    aria-label={t('Leave organization')}
                                    onPress={() => setLeaving(organization)}
                                    data-test="organization-leave-button"
                                >
                                    <LogOut className="size-4" />
                                </Button>
                            )}
                            <Link
                                href={edit(organization.slug)}
                                className={buttonVariants({
                                    variant: 'secondary',
                                    size: 'sm',
                                })}
                                data-test="organization-edit-button"
                            >
                                {organization.role === 'member'
                                    ? t('View')
                                    : t('Manage')}
                            </Link>
                        </div>
                    </li>
                ))}

                {organizations.length === 0 && (
                    <li className="p-8 text-center text-sm text-muted">
                        {t("You don't belong to any organization yet.")}
                    </li>
                )}
            </ul>

            <CreateOrganizationModal
                isOpen={isCreateOpen}
                onOpenChange={setCreateOpen}
            />

            <ConfirmDialog
                isOpen={leaving !== null}
                onOpenChange={(isOpen) => !isOpen && setLeaving(null)}
                title={t('Leave organization')}
                confirmLabel={t('Leave organization')}
                onConfirm={leaveOrganization}
                isPending={isProcessing}
                data-test="leave-organization-confirm"
            >
                <p className="text-sm">
                    {t(
                        'You will lose access to ":name" until someone invites you again.',
                        { name: leaveTarget?.name ?? '' },
                    )}
                </p>
            </ConfirmDialog>
        </>
    );
}

OrganizationsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Organizations',
            href: index(),
        },
    ],
};
