import { Button, Link } from '@heroui/react';
import { Form, Head } from '@inertiajs/react';
import { GoogleButton } from '@/components/auth/google-button';
import { OrSeparator } from '@/components/auth/or-separator';
import { TextInputField } from '@/components/form/text-input-field';
import { useTranslation } from '@/lib/i18n';
import { login } from '@/routes';
import { store } from '@/routes/register';

type Props = {
    google: boolean;
    status?: string;
};

/**
 * Open registration: name + email → an emailed link verifies the address → create a passkey.
 */
export default function Register({ google, status }: Props) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Create an account')} />

            {status ? (
                <p
                    className="rounded-xl bg-accent-soft p-3 text-center text-sm text-accent-soft-foreground"
                    data-test="register-status"
                >
                    {status}
                </p>
            ) : (
                <>
                    {google && (
                        <>
                            <GoogleButton />
                            <OrSeparator label={t('or with your email')} />
                        </>
                    )}

                    <Form {...store.form()} className="grid gap-4">
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
                                <Button
                                    type="submit"
                                    fullWidth
                                    isPending={processing}
                                    data-test="register-user-button"
                                >
                                    {t('Continue')}
                                </Button>
                            </>
                        )}
                    </Form>
                </>
            )}

            <p className="text-center text-sm text-muted">
                {t('Already have an account?')}{' '}
                <Link href={login().url}>{t('Log in')}</Link>
            </p>
        </>
    );
}

Register.layout = {
    title: 'Create an account',
    description:
        'We email you a link, then you create a passkey. No password needed.',
};
