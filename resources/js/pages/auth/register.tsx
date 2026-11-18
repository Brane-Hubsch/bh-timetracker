import { Button, Link } from '@heroui/react';
import { Form, Head } from '@inertiajs/react';
import { TextInputField } from '@/components/form/text-input-field';
import OrganizationInvitationAlert from '@/components/organization-invitation-alert';
import { useTranslation } from '@/lib/i18n';
import { login } from '@/routes';
import { store } from '@/routes/register';
import type { OrganizationInvitationContext } from '@/types';

type Props = {
    passwordRules: string;
    organizationInvitation?: OrganizationInvitationContext | null;
};

export default function Register({
    passwordRules,
    organizationInvitation,
}: Props) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Create an account')} />

            {organizationInvitation && (
                <OrganizationInvitationAlert
                    invitation={organizationInvitation}
                    action="register"
                />
            )}

            <Form
                {...store.form()}
                resetOnSuccess={['password', 'password_confirmation']}
                disableWhileProcessing
                className="grid gap-4"
            >
                {({ processing, errors }) => (
                    <>
                        <TextInputField
                            name="name"
                            label={t('Name')}
                            error={errors.name}
                            isRequired
                            autoComplete="name"
                            autoFocus
                        />
                        <TextInputField
                            name="email"
                            type="email"
                            label={t('Email address')}
                            error={errors.email}
                            isRequired
                            autoComplete="email"
                        />
                        <TextInputField
                            name="password"
                            type="password"
                            label={t('Password')}
                            error={errors.password}
                            isRequired
                            autoComplete="new-password"
                            passwordrules={passwordRules}
                        />
                        <TextInputField
                            name="password_confirmation"
                            type="password"
                            label={t('Confirm password')}
                            error={errors.password_confirmation}
                            isRequired
                            autoComplete="new-password"
                            passwordrules={passwordRules}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            isPending={processing}
                            data-test="register-user-button"
                        >
                            {t('Create account')}
                        </Button>
                        <p className="text-center text-sm text-muted">
                            {t('Already have an account?')}{' '}
                            <Link
                                href={
                                    (organizationInvitation
                                        ? login({
                                              query: {
                                                  invitation:
                                                      organizationInvitation.code,
                                              },
                                          })
                                        : login()
                                    ).url
                                }
                                data-test="organization-invitation-login-link"
                            >
                                {t('Log in')}
                            </Link>
                        </p>
                    </>
                )}
            </Form>
        </>
    );
}

Register.layout = {
    title: 'Create an account',
    description: 'Enter your details to get started.',
};
