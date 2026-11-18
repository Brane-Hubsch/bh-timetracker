import { Button, Checkbox, Link } from '@heroui/react';
import { Form, Head } from '@inertiajs/react';
import { TextInputField } from '@/components/form/text-input-field';
import OrganizationInvitationAlert from '@/components/organization-invitation-alert';
import PasskeyVerify from '@/components/passkey-verify';
import { useTranslation } from '@/lib/i18n';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';
import type { OrganizationInvitationContext } from '@/types';

type Props = {
    status?: string;
    canResetPassword: boolean;
    organizationInvitation?: OrganizationInvitationContext | null;
};

export default function Login({
    status,
    canResetPassword,
    organizationInvitation,
}: Props) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Log in')} />

            {organizationInvitation && (
                <OrganizationInvitationAlert
                    invitation={organizationInvitation}
                    action="login"
                />
            )}

            {status && (
                <p className="text-center text-sm font-medium text-success">
                    {status}
                </p>
            )}

            <PasskeyVerify />

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="grid gap-4"
            >
                {({ processing, errors }) => (
                    <>
                        <TextInputField
                            name="email"
                            type="email"
                            label={t('Email address')}
                            error={errors.email}
                            isRequired
                            autoComplete="email webauthn"
                        />
                        <TextInputField
                            name="password"
                            type="password"
                            label={t('Password')}
                            error={errors.password}
                            isRequired
                            autoComplete="current-password"
                        />
                        <div className="flex items-center justify-between gap-4">
                            <Checkbox name="remember">
                                <Checkbox.Content>
                                    <Checkbox.Control>
                                        <Checkbox.Indicator />
                                    </Checkbox.Control>
                                    {t('Remember me')}
                                </Checkbox.Content>
                            </Checkbox>
                            {canResetPassword && (
                                <Link href={request().url} className="text-sm">
                                    {t('Forgot password?')}
                                </Link>
                            )}
                        </div>
                        <Button
                            type="submit"
                            fullWidth
                            isPending={processing}
                            data-test="login-button"
                        >
                            {t('Log in')}
                        </Button>
                        <p className="text-center text-sm text-muted">
                            {t("Don't have an account?")}{' '}
                            <Link
                                href={
                                    register({
                                        query: {
                                            invitation:
                                                organizationInvitation?.code,
                                        },
                                    }).url
                                }
                                data-test="register-link"
                            >
                                {t('Sign up')}
                            </Link>
                        </p>
                    </>
                )}
            </Form>
        </>
    );
}

Login.layout = {
    title: 'Log in to BH Timetracker',
    description: 'Use a passkey or your email and password.',
};
