import { Button } from '@heroui/react';
import { Form, Head } from '@inertiajs/react';
import {
    index as confirmOptions,
    store as confirmStore,
} from '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyConfirmationController';
import { OrSeparator } from '@/components/auth/or-separator';
import { PasskeyButton } from '@/components/auth/passkey-button';
import { TextInputField } from '@/components/form/text-input-field';
import { useTranslation } from '@/lib/i18n';
import { confirm as requestConfirmationLink } from '@/routes/magic-link';
import { store as confirmWithPassword } from '@/routes/password/confirm';

type Props = {
    status?: string;
    hasPasskeys: boolean;
    passwordLogin: boolean;
};

/**
 * Sensitive actions (managing passkeys, deleting the account) need a recent sign-in. Confirm with a
 * passkey, or with an emailed link (password only in development).
 */
export default function ConfirmAccess({
    status,
    hasPasskeys,
    passwordLogin,
}: Props) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Confirm it is you')} />

            {status && (
                <p className="rounded-xl bg-accent-soft p-3 text-center text-sm text-accent-soft-foreground">
                    {status}
                </p>
            )}

            {hasPasskeys && (
                <>
                    <PasskeyButton
                        label={t('Confirm with passkey')}
                        routes={{
                            options: confirmOptions(),
                            submit: confirmStore(),
                        }}
                    />
                    <OrSeparator label={t('or')} />
                </>
            )}

            <Form {...requestConfirmationLink.form()}>
                {({ processing }) => (
                    <Button
                        type="submit"
                        variant="secondary"
                        fullWidth
                        isPending={processing}
                        data-test="confirm-link-button"
                    >
                        {t('Email me a confirmation link')}
                    </Button>
                )}
            </Form>

            {passwordLogin && (
                <Form
                    {...confirmWithPassword.form()}
                    resetOnSuccess={['password']}
                    className="grid gap-3 rounded-2xl border border-dashed border-warning/50 p-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <TextInputField
                                name="password"
                                type="password"
                                label={t('Password (development only)')}
                                error={errors.password}
                                autoComplete="current-password"
                            />
                            <Button
                                type="submit"
                                variant="tertiary"
                                fullWidth
                                isPending={processing}
                                data-test="confirm-password-button"
                            >
                                {t('Confirm')}
                            </Button>
                        </>
                    )}
                </Form>
            )}
        </>
    );
}

ConfirmAccess.layout = {
    title: 'Confirm it is you',
    description: 'This action needs a recent sign-in.',
};
