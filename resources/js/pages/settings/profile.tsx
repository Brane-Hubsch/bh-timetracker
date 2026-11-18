import { Button } from '@heroui/react';
import { Form, Head, Link, usePage } from '@inertiajs/react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/delete-user';
import { TextInputField } from '@/components/form/text-input-field';
import Heading from '@/components/heading';
import { useTranslation } from '@/lib/i18n';
import { edit } from '@/routes/profile';
import { send } from '@/routes/verification';

export default function Profile({
    mustVerifyEmail,
    status,
}: {
    mustVerifyEmail: boolean;
    status?: string;
}) {
    const { t } = useTranslation();
    const { auth } = usePage().props;

    return (
        <>
            <Head title={t('Profile')} />

            <section className="grid gap-6">
                <Heading
                    variant="small"
                    title={t('Profile')}
                    description={t('Your name and email address.')}
                />

                <Form
                    {...ProfileController.update.form()}
                    options={{ preserveScroll: true }}
                    className="grid gap-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <TextInputField
                                name="name"
                                label={t('Name')}
                                defaultValue={auth.user.name}
                                error={errors.name}
                                isRequired
                                autoComplete="name"
                            />
                            <TextInputField
                                name="email"
                                type="email"
                                label={t('Email address')}
                                defaultValue={auth.user.email}
                                error={errors.email}
                                isRequired
                                autoComplete="username"
                            />

                            {mustVerifyEmail &&
                                auth.user.email_verified_at === null && (
                                    <p className="text-sm text-muted">
                                        {t('Your email address is unverified.')}{' '}
                                        <Link
                                            href={send()}
                                            as="button"
                                            className="text-foreground underline underline-offset-4"
                                        >
                                            {t(
                                                'Resend the verification email.',
                                            )}
                                        </Link>
                                        {status ===
                                            'verification-link-sent' && (
                                            <span className="mt-2 block font-medium text-success">
                                                {t(
                                                    'A new verification link has been sent to your email address.',
                                                )}
                                            </span>
                                        )}
                                    </p>
                                )}

                            <div>
                                <Button
                                    type="submit"
                                    isPending={processing}
                                    data-test="update-profile-button"
                                >
                                    {t('Save')}
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </section>

            <DeleteUser />
        </>
    );
}

Profile.layout = {
    breadcrumbs: [
        {
            title: 'Profile',
            href: edit(),
        },
    ],
};
