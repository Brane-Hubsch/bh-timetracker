import { Modal } from '@heroui/react';
import { Head, usePage } from '@inertiajs/react';
import { Clock } from 'lucide-react';
import { useState } from 'react';
import Heading from '@/components/heading';
import { PendingInvitationList } from '@/components/pending-invitation-list';
import { useTranslation } from '@/lib/i18n';
import { dashboard } from '@/routes';
import type { DashboardInvitation } from '@/types';

type Props = {
    pendingInvitations?: DashboardInvitation[];
};

export default function Dashboard({ pendingInvitations = [] }: Props) {
    const { t } = useTranslation();
    const { auth, currentOrganization } = usePage().props;
    const [showInvitations, setShowInvitations] = useState(
        pendingInvitations.length > 0,
    );

    return (
        <>
            <Head title={t('Today')} />

            <div className="grid gap-6">
                <Heading
                    title={t('Hi :name!', {
                        name: auth.user.name.split(' ')[0],
                    })}
                    description={currentOrganization?.name}
                />

                <div className="grid justify-items-center gap-3 rounded-2xl bg-surface p-10 text-center shadow-surface">
                    <Clock className="size-8 text-muted" />
                    <p className="font-medium">{t('No time reported yet')}</p>
                    <p className="max-w-sm text-sm text-muted">
                        {t(
                            'Time reporting arrives in an upcoming version. Your organization is ready.',
                        )}
                    </p>
                </div>
            </div>

            <Modal.Backdrop
                isOpen={pendingInvitations.length > 0 && showInvitations}
                onOpenChange={setShowInvitations}
            >
                <Modal.Container>
                    <Modal.Dialog
                        className="sm:max-w-md"
                        data-test="pending-invitations-modal"
                    >
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>
                                {t('Pending invitations')}
                            </Modal.Heading>
                        </Modal.Header>
                        <Modal.Body>
                            <PendingInvitationList
                                invitations={pendingInvitations}
                                onDeclined={() =>
                                    pendingInvitations.length === 1 &&
                                    setShowInvitations(false)
                                }
                            />
                        </Modal.Body>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </>
    );
}

Dashboard.layout = (props: {
    currentOrganization?: { slug: string } | null;
}) => ({
    breadcrumbs: props.currentOrganization
        ? [{ title: 'Today', href: dashboard(props.currentOrganization.slug) }]
        : [],
});
