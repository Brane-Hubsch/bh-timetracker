import { Button } from '@heroui/react';
import { Form, Head, router } from '@inertiajs/react';
import { useTranslation } from '@/lib/i18n';
import { logout } from '@/routes';
import { send } from '@/routes/verification';

export default function VerifyEmail({ status }: { status?: string }) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Email verification')} />

            {status === 'verification-link-sent' && (
                <p className="rounded-xl bg-accent-soft p-3 text-center text-sm text-accent-soft-foreground">
                    {t(
                        'A new verification link has been sent to your email address.',
                    )}
                </p>
            )}

            <Form {...send.form()} className="grid gap-3">
                {({ processing }) => (
                    <>
                        <Button type="submit" fullWidth isPending={processing}>
                            {t('Resend verification email')}
                        </Button>
                        <Button
                            variant="ghost"
                            fullWidth
                            onPress={() => router.visit(logout())}
                        >
                            {t('Log out')}
                        </Button>
                    </>
                )}
            </Form>
        </>
    );
}

VerifyEmail.layout = {
    title: 'Email verification',
    description:
        'Please verify your email address by clicking on the link we just emailed to you.',
};
