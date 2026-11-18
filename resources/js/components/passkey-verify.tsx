import { Button, Separator } from '@heroui/react';
import type { UrlMethodPair } from '@inertiajs/core';
import { router } from '@inertiajs/react';
import { usePasskeyVerify } from '@laravel/passkeys/react';
import { KeyRound } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

type Props = {
    routes?: {
        options: UrlMethodPair;
        submit: UrlMethodPair;
    };
    label?: string;
    separator?: string;
};

export default function PasskeyVerify({
    routes,
    label,
    separator,
}: Props = {}) {
    const { t } = useTranslation();
    const { verify, isLoading, error, isSupported } = usePasskeyVerify({
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
        <>
            <div className="grid gap-2">
                <Button
                    variant="secondary"
                    fullWidth
                    onPress={() => void verify()}
                    isPending={isLoading}
                >
                    <KeyRound className="size-4" />
                    {label ?? t('Sign in with a passkey')}
                </Button>
                {error && (
                    <p className="text-center text-sm text-danger">{error}</p>
                )}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted">
                <Separator className="flex-1" />
                {separator ?? t('or continue with email')}
                <Separator className="flex-1" />
            </div>
        </>
    );
}
