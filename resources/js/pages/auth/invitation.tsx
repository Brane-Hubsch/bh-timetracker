import { Button, buttonVariants } from '@heroui/react';
import { Form, Head, Link, router } from '@inertiajs/react';
import { GoogleButton } from '@/components/auth/google-button';
import { OrSeparator } from '@/components/auth/or-separator';
import { TextInputField } from '@/components/form/text-input-field';
import { useTranslation } from '@/lib/i18n';
import { home, login, logout } from '@/routes';
import { store as createAccount } from '@/routes/invitations/account';

type Props = {
    invitation: {
        code: string;
        email: string;
        organizationName: string;
        inviterName: string;
        roleLabel: string;
        status: 'pending' | 'accepted' | 'expired';
    };
    accountExists: boolean;
    signedInEmail: string | null;
    google: boolean;
};

export default function Invitation({
    invitation,
    accountExists,
    signedInEmail,
    google,
}: Props) {
    const { t } = useTranslation();
    const isForSignedInUser =
        signedInEmail !== null &&
        signedInEmail.toLowerCase() === invitation.email.toLowerCase();

    return (
        <>
            <Head title={invitation.organizationName} />

            <div className="grid gap-1 text-center">
                <p className="text-lg font-semibold">
                    {invitation.organizationName}
                </p>
                <p className="text-sm text-muted">
                    {t(':name invited :email as :role.', {
                        name: invitation.inviterName,
                        email: invitation.email,
                        role: invitation.roleLabel.toLowerCase(),
                    })}
                </p>
            </div>

            {invitation.status !== 'pending' ? (
                <p
                    className="text-center text-sm"
                    data-test="invitation-unavailable"
                >
                    {invitation.status === 'accepted'
                        ? t('This invitation has already been accepted.')
                        : t('This invitation has expired. Ask for a new one.')}
                </p>
            ) : signedInEmail !== null ? (
                isForSignedInUser ? (
                    <Link
                        href={home()}
                        className={buttonVariants({ fullWidth: true })}
                    >
                        {t('Go to your invitations')}
                    </Link>
                ) : (
                    <div className="grid gap-3 text-center">
                        <p className="text-sm">
                            {t(
                                'You are signed in as :email. Sign out to accept this invitation.',
                                { email: signedInEmail },
                            )}
                        </p>
                        <Button
                            variant="secondary"
                            fullWidth
                            onPress={() => router.visit(logout())}
                        >
                            {t('Log out')}
                        </Button>
                    </div>
                )
            ) : accountExists ? (
                <Link
                    href={login({ query: { invitation: invitation.code } })}
                    className={buttonVariants({ fullWidth: true })}
                    data-test="invitation-login"
                >
                    {t('Sign in to accept')}
                </Link>
            ) : (
                <>
                    {google && <GoogleButton invitation={invitation.code} />}
                    {google && (
                        <OrSeparator label={t('or create an account')} />
                    )}
                    <Form
                        {...createAccount.form(invitation.code)}
                        className="grid gap-4"
                    >
                        {({ processing, errors }) => (
                            <>
                                <TextInputField
                                    name="name"
                                    label={t('Your name')}
                                    error={errors.name}
                                    isRequired
                                    autoComplete="name"
                                    autoFocus
                                />
                                <Button
                                    type="submit"
                                    fullWidth
                                    isPending={processing}
                                    data-test="invitation-create-account"
                                >
                                    {t('Create account')}
                                </Button>
                                <p className="text-center text-xs text-muted">
                                    {t(
                                        'Next you create a passkey: sign in with your fingerprint, face or device PIN.',
                                    )}
                                </p>
                            </>
                        )}
                    </Form>
                </>
            )}
        </>
    );
}

Invitation.layout = {
    title: 'You are invited',
};
