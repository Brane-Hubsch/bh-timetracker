import { Button } from '@heroui/react';
import { usePasskeyRegister } from '@laravel/passkeys/react';
import { useState } from 'react';
import { TextInputField } from '@/components/form/text-input-field';
import { useTranslation } from '@/lib/i18n';

type Props = {
    onSuccess: () => void;
    /** Show the name form right away (passkey setup page). */
    initiallyOpen?: boolean;
};

/** Suggest a passkey name such as "Safari on iPhone" from the user agent. */
function suggestedName(): string {
    const ua = navigator.userAgent;
    const browser = [
        { pattern: /Edg|Edge/, name: 'Edge' },
        { pattern: /OPR|Opera|OPiOS/, name: 'Opera' },
        { pattern: /Firefox|FxiOS/, name: 'Firefox' },
        { pattern: /Chrome|CriOS/, name: 'Chrome' },
        { pattern: /Safari/, name: 'Safari' },
    ].find(({ pattern }) => pattern.test(ua))?.name;
    const os = [
        { pattern: /iPhone/, name: 'iPhone' },
        { pattern: /iPad|Macintosh(?=.*Mobile)/, name: 'iPad' },
        { pattern: /Android/, name: 'Android' },
        { pattern: /Mac/, name: 'Mac' },
        { pattern: /Windows/, name: 'Windows' },
    ].find(({ pattern }) => pattern.test(ua))?.name;

    return [browser, os].filter(Boolean).join(' / ');
}

export default function PasskeyRegistration({
    onSuccess,
    initiallyOpen = false,
}: Props) {
    const { t } = useTranslation();
    const [name, setName] = useState(suggestedName);
    const [showForm, setShowForm] = useState(initiallyOpen);
    const { register, isLoading, error, isSupported } = usePasskeyRegister({
        onSuccess: () => {
            setShowForm(false);
            onSuccess();
        },
    });

    if (!isSupported) {
        return (
            <p className="text-sm text-muted">
                {t('Passkeys are not supported in this browser.')}
            </p>
        );
    }

    if (!showForm) {
        return (
            <div>
                <Button variant="secondary" onPress={() => setShowForm(true)}>
                    {t('Add passkey')}
                </Button>
            </div>
        );
    }

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();

                if (name.trim()) {
                    void register(name);
                }
            }}
            className="grid gap-4 rounded-2xl bg-surface-secondary p-4"
        >
            <TextInputField
                name="passkey-name"
                label={t('Passkey name')}
                description={t('Helps you recognise this passkey later.')}
                value={name}
                onChange={setName}
                error={error ?? undefined}
                autoFocus
            />
            <div className="flex gap-2">
                <Button
                    type="submit"
                    isPending={isLoading}
                    isDisabled={!name.trim()}
                    data-test="register-passkey-button"
                >
                    {t('Register passkey')}
                </Button>
                {!initiallyOpen && (
                    <Button variant="ghost" onPress={() => setShowForm(false)}>
                        {t('Cancel')}
                    </Button>
                )}
            </div>
        </form>
    );
}
