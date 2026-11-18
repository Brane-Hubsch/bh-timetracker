import { Alert } from '@heroui/react';
import { useTranslation } from '@/lib/i18n';
import type { OrganizationInvitationContext } from '@/types';

type Props = {
    invitation: OrganizationInvitationContext;
    action: 'login' | 'register';
};

export default function OrganizationInvitationAlert({
    invitation,
    action,
}: Props) {
    const { t } = useTranslation();

    return (
        <Alert status="accent" data-test="organization-invitation-alert">
            <Alert.Indicator />
            <Alert.Content>
                <Alert.Description>
                    {action === 'login'
                        ? t('Log in to join ":name".', {
                              name: invitation.organizationName,
                          })
                        : t('Create an account to join ":name".', {
                              name: invitation.organizationName,
                          })}
                </Alert.Description>
            </Alert.Content>
        </Alert>
    );
}
