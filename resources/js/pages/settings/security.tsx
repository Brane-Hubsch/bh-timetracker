import { Head } from '@inertiajs/react';
import ManagePasskeys from '@/components/manage-passkeys';
import { useTranslation } from '@/lib/i18n';
import { edit } from '@/routes/security';
import type { Passkey } from '@/types/auth';

export default function Security({ passkeys }: { passkeys: Passkey[] }) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Security')} />

            <ManagePasskeys passkeys={passkeys} />

            <p className="text-sm text-muted">
                {t(
                    'Lost all your passkeys? You can always sign in with an email link and add a new one.',
                )}
            </p>
        </>
    );
}

Security.layout = {
    breadcrumbs: [
        {
            title: 'Security',
            href: edit(),
        },
    ],
};
