import { Button, Separator } from '@heroui/react';
import { Form, Head } from '@inertiajs/react';
import OnboardingController from '@/actions/App/Http/Controllers/OnboardingController';
import { TextInputField } from '@/components/form/text-input-field';
import { PendingInvitationList } from '@/components/pending-invitation-list';
import { useTranslation } from '@/lib/i18n';
import type { DashboardInvitation } from '@/types';

type Props = {
    pendingInvitations: DashboardInvitation[];
};

export default function Onboarding({ pendingInvitations }: Props) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Get started')} />

            {pendingInvitations.length > 0 && (
                <>
                    <section className="grid gap-3">
                        <h2 className="text-sm font-medium">
                            {t('You have been invited to')}
                        </h2>
                        <PendingInvitationList
                            invitations={pendingInvitations}
                        />
                    </section>
                    <Separator />
                </>
            )}

            <Form {...OnboardingController.store.form()} className="grid gap-4">
                {({ processing, errors }) => (
                    <>
                        <h2 className="text-sm font-medium">
                            {t('Create an organization')}
                        </h2>
                        <TextInputField
                            name="name"
                            label={t('Organization name')}
                            error={errors.name}
                            isRequired
                            autoFocus={pendingInvitations.length === 0}
                            data-test="organization-name"
                        />
                        <Button
                            type="submit"
                            fullWidth
                            isPending={processing}
                            data-test="create-organization-button"
                        >
                            {t('Create organization')}
                        </Button>
                    </>
                )}
            </Form>
        </>
    );
}

Onboarding.layout = {
    title: 'Welcome to :app',
    description:
        'Accept an invitation or create a new organization to get started.',
};
