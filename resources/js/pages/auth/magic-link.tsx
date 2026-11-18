import { Button, buttonVariants } from '@heroui/react';
import { Form, Head, Link } from '@inertiajs/react';
import { useTranslation } from '@/lib/i18n';
import { login } from '@/routes';
import { consume } from '@/routes/magic-link';

type Props = {
    token: string;
    isValid: boolean;
    email: string | null;
};

/**
 * Opening an emailed link lands here; signing in requires a click so link scanners cannot use it.
 */
export default function MagicLink({ token, isValid, email }: Props) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Sign in')} />

            {isValid ? (
                <Form {...consume.form(token)} className="grid gap-4">
                    {({ processing }) => (
                        <>
                            <p className="text-center text-sm">
                                {t('Continue as :email', {
                                    email: email ?? '',
                                })}
                            </p>
                            <Button
                                type="submit"
                                fullWidth
                                isPending={processing}
                                data-test="magic-link-continue"
                            >
                                {t('Sign in')}
                            </Button>
                        </>
                    )}
                </Form>
            ) : (
                <div className="grid gap-4 text-center">
                    <p className="text-sm">
                        {t(
                            'That sign-in link has expired or was already used. Request a new one.',
                        )}
                    </p>
                    <Link
                        href={login()}
                        className={buttonVariants({ fullWidth: true })}
                    >
                        {t('Back to sign in')}
                    </Link>
                </div>
            )}
        </>
    );
}

MagicLink.layout = {
    title: 'Sign in to BH Timetracker',
};
