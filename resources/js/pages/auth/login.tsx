import { Button, Chip, Link } from '@heroui/react';
import { Form, Head } from '@inertiajs/react';
import { GoogleButton } from '@/components/auth/google-button';
import { OrSeparator } from '@/components/auth/or-separator';
import { PasskeyButton } from '@/components/auth/passkey-button';
import { TextInputField } from '@/components/form/text-input-field';
import OrganizationInvitationAlert from '@/components/organization-invitation-alert';
import { useTranslation } from '@/lib/i18n';
import { register } from '@/routes';
import { store as passwordLogin } from '@/routes/login';
import { store as requestMagicLink } from '@/routes/magic-link';
import type { OrganizationInvitationContext, SignInOptions } from '@/types';

type Props = {
    status?: string;
    signInOptions: SignInOptions;
    organizationInvitation?: OrganizationInvitationContext | null;
};

export default function Login({
    status,
    signInOptions,
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
                <p
                    className="rounded-xl bg-accent-soft p-3 text-center text-sm text-accent-soft-foreground"
                    data-test="login-status"
                >
                    {status}
                </p>
            )}

            <div className="grid gap-3">
                <PasskeyButton label={t('Sign in with a passkey')} autofill />
                {signInOptions.google && (
                    <GoogleButton invitation={organizationInvitation?.code} />
                )}
            </div>

            <OrSeparator label={t('or get a sign-in link by email')} />

            <Form
                {...requestMagicLink.form()}
                resetOnSuccess
                className="grid gap-3"
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
                            data-test="magic-link-email"
                        />
                        <Button
                            type="submit"
                            variant="secondary"
                            fullWidth
                            isPending={processing}
                            data-test="magic-link-button"
                        >
                            {t('Email me a sign-in link')}
                        </Button>
                        <p className="text-center text-xs text-muted">
                            {t(
                                'Lost your passkey? Sign in with an email link and add a new one.',
                            )}
                        </p>
                    </>
                )}
            </Form>

            {signInOptions.passwordLogin && (
                <Form
                    {...passwordLogin.form()}
                    errorBag="passwordLogin"
                    resetOnSuccess={['password']}
                    className="grid gap-3 rounded-2xl border border-dashed border-warning/50 p-4"
                    data-test="password-login-form"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium">
                                    {t('Password login')}
                                </span>
                                <Chip size="sm" color="warning" variant="soft">
                                    {t('Development only')}
                                </Chip>
                            </div>
                            <TextInputField
                                name="email"
                                type="email"
                                label={t('Email address')}
                                error={errors.email}
                                autoComplete="username"
                            />
                            <TextInputField
                                name="password"
                                type="password"
                                label={t('Password')}
                                error={errors.password}
                                autoComplete="current-password"
                            />
                            <input type="hidden" name="remember" value="on" />
                            <Button
                                type="submit"
                                variant="tertiary"
                                fullWidth
                                isPending={processing}
                                data-test="login-button"
                            >
                                {t('Log in with password')}
                            </Button>
                        </>
                    )}
                </Form>
            )}

            <p className="text-center text-sm text-muted">
                {signInOptions.openRegistration ? (
                    <>
                        {t("Don't have an account?")}{' '}
                        <Link href={register().url} data-test="register-link">
                            {t('Sign up')}
                        </Link>
                    </>
                ) : (
                    t('Accounts are created by invitation.')
                )}
            </p>
        </>
    );
}

Login.layout = {
    title: 'Log in to :app',
    description: 'Use a passkey, Google or an email link.',
};
