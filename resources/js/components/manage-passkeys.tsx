import { router } from '@inertiajs/react';
import { KeyRound } from 'lucide-react';
import { destroy } from '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyRegistrationController';
import Heading from '@/components/heading';
import PasskeyItem from '@/components/passkey-item';
import PasskeyRegistration from '@/components/passkey-register';
import { useTranslation } from '@/lib/i18n';
import type { Passkey } from '@/types/auth';

export type Props = {
    canManagePasskeys?: boolean;
    passkeys?: Passkey[];
};

export default function ManagePasskeys(props: Props) {
    const { t } = useTranslation();
    const passkeys = props.passkeys ?? [];

    if (!(props.canManagePasskeys ?? false)) {
        return null;
    }

    const handleDelete = (id: number, onFinish: () => void) => {
        router.delete(destroy.url(id), {
            preserveScroll: true,
            onFinish,
        });
    };

    return (
        <section className="grid gap-4">
            <Heading
                variant="small"
                title={t('Passkeys')}
                description={t(
                    'Sign in with your fingerprint, face or device PIN instead of a password.',
                )}
            />

            <ul className="divide-y divide-separator rounded-2xl bg-surface shadow-surface">
                {passkeys.map((passkey) => (
                    <PasskeyItem
                        key={passkey.id}
                        passkey={passkey}
                        onDelete={handleDelete}
                    />
                ))}
                {passkeys.length === 0 && (
                    <li className="grid justify-items-center gap-2 p-8 text-center">
                        <KeyRound className="size-6 text-muted" />
                        <p className="font-medium">{t('No passkeys yet')}</p>
                    </li>
                )}
            </ul>

            <PasskeyRegistration onSuccess={() => router.reload()} />
        </section>
    );
}
