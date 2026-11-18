import { Button, Card } from '@heroui/react';
import { router } from '@inertiajs/react';
import { useState } from 'react';
import OrganizationInvitationController from '@/actions/App/Http/Controllers/Organizations/OrganizationInvitationController';
import { useTranslation } from '@/lib/i18n';
import type { DashboardInvitation } from '@/types';

type Props = {
    invitations: DashboardInvitation[];
    onDeclined?: (invitation: DashboardInvitation) => void;
};

export function PendingInvitationList({ invitations, onDeclined }: Props) {
    const { t } = useTranslation();
    const [processingCode, setProcessingCode] = useState<string | null>(null);

    const respond = (
        invitation: DashboardInvitation,
        response: 'accept' | 'decline',
    ) => {
        router.visit(OrganizationInvitationController[response](invitation), {
            onStart: () => setProcessingCode(invitation.code),
            onFinish: () => setProcessingCode(null),
            onSuccess: () => {
                if (response === 'decline') {
                    onDeclined?.(invitation);
                }
            },
        });
    };

    return (
        <div className="grid gap-3">
            {invitations.map((invitation) => (
                <Card
                    key={invitation.code}
                    variant="secondary"
                    data-test="pending-invitation-row"
                >
                    <Card.Header>
                        <Card.Title>{invitation.organization.name}</Card.Title>
                        <Card.Description>
                            {t(':name invited you to join this organization.', {
                                name: invitation.inviterName,
                            })}
                        </Card.Description>
                    </Card.Header>
                    <Card.Footer className="justify-end gap-2">
                        <Button
                            variant="secondary"
                            data-test="pending-invitation-decline"
                            isDisabled={processingCode === invitation.code}
                            onPress={() => respond(invitation, 'decline')}
                        >
                            {t('Decline')}
                        </Button>
                        <Button
                            data-test="pending-invitation-accept"
                            isPending={processingCode === invitation.code}
                            onPress={() => respond(invitation, 'accept')}
                        >
                            {t('Accept')}
                        </Button>
                    </Card.Footer>
                </Card>
            ))}
        </div>
    );
}
