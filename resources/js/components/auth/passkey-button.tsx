import { Button } from '@heroui/react';
import type { UrlMethodPair } from '@inertiajs/core';
import { router } from '@inertiajs/react';
import { usePasskeyVerify } from '@laravel/passkeys/react';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';

type Props = {
    label: string;
    /** Custom routes, e.g. for confirming access instead of signing in. */
    routes?: {
        options: UrlMethodPair;
        submit: UrlMethodPair;
    };
    /** Offer saved passkeys in the browser's autofill on an input with autocomplete="email webauthn". */
    autofill?: boolean;
    variant?: 'primary' | 'secondary';
};

/**
 * Sign in (or confirm access) with a passkey. Renders nothing in browsers without passkey support.
 */
export function PasskeyButton({
    label,
    routes,
    autofill = false,
    variant = 'primary',
}: Props) {
    const { t } = useTranslation();
    // Autofill runs in the background and is aborted when the user does something else; only report
    // errors from attempts the user started.
    const [hasPressed, setHasPressed] = useState(false);
    const { verify, isLoading, error, isSupported } = usePasskeyVerify({
        autofill,
        ...(routes && {
            routes: {
                options: routes.options.url,
                submit: routes.submit.url,
            },
        }),
        onSuccess: (response) => {
            router.visit(response.redirect ?? '/');
        },
    });

    if (!isSupported) {
        return null;
    }

    return (
        <div className="grid gap-2">
            <Button
                variant={variant}
                fullWidth
                onPress={() => {
                    setHasPressed(true);
                    void verify();
                }}
                isPending={isLoading}
                data-test="passkey-button"
            >
                <KeyRound className="size-4" />
                {label}
            </Button>
            {error && hasPressed && (
                <p className="text-center text-sm text-danger">
                    {t(
                        'The passkey could not be used. Try again or use an email link.',
                    )}
                </p>
            )}
        </div>
    );
}
