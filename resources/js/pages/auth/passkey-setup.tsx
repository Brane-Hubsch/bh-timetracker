import { buttonVariants } from '@heroui/react';
import { Head, Link, router } from '@inertiajs/react';
import { KeyRound } from 'lucide-react';
import PasskeyRegistration from '@/components/passkey-register';
import { useTranslation } from '@/lib/i18n';

type Props = {
    continueTo: string;
};

/**
 * Offered after sign-up or an email-link sign-in.
 */
export default function PasskeySetup({ continueTo }: Props) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Create a passkey')} />

            <div className="grid justify-items-center gap-2 text-center">
                <KeyRound className="size-8 text-accent" />
                <p className="text-sm text-muted">
                    {t(
                        'Next time you sign in with your fingerprint, face or device PIN. No password to remember.',
                    )}
                </p>
            </div>

            <PasskeyRegistration
                initiallyOpen
                onSuccess={() => router.visit(continueTo)}
            />

            <Link
                href={continueTo}
                className={buttonVariants({
                    variant: 'ghost',
                    fullWidth: true,
                })}
                data-test="passkey-setup-skip"
            >
                {t('Not now')}
            </Link>
        </>
    );
}

PasskeySetup.layout = {
    title: 'Create a passkey',
};
