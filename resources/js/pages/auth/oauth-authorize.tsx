import { Button } from '@heroui/react';
import { Head, usePage } from '@inertiajs/react';
import { Bot } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

type Props = {
    client: { id: string; name: string };
    redirectHost: string | null;
    scopes: string[];
    state: string | null;
    authToken: string;
    csrfToken: string;
    /** Passport's approve (POST) / deny (DELETE) endpoint. */
    action: string;
};

/**
 * OAuth consent screen shown when an AI assistant (MCP client) asks to connect. Plain forms, since
 * Passport redirects back to the client's site, which an Inertia request cannot follow.
 */
export default function OAuthAuthorize({
    client,
    redirectHost,
    state,
    authToken,
    csrfToken,
    action,
}: Props) {
    const { t } = useTranslation();
    const { auth } = usePage().props;

    const fields = (
        <>
            <input type="hidden" name="_token" value={csrfToken} />
            <input type="hidden" name="state" value={state ?? ''} />
            <input type="hidden" name="client_id" value={client.id} />
            <input type="hidden" name="auth_token" value={authToken} />
        </>
    );

    return (
        <>
            <Head title={t('Connect :client', { client: client.name })} />

            <div className="grid justify-items-center gap-3 text-center">
                <Bot className="size-8 text-accent" />
                <p className="text-sm">
                    {t(
                        ':client wants to use BH Timetracker as :name. It can read and report time, clients and projects with the same permissions as you.',
                        { client: client.name, name: auth.user?.name ?? '' },
                    )}
                </p>
                {redirectHost && (
                    <p className="text-xs text-muted">
                        {t('You will be sent back to :host.', {
                            host: redirectHost,
                        })}
                    </p>
                )}
            </div>

            <form method="post" action={action}>
                {fields}
                <Button type="submit" fullWidth data-test="oauth-approve">
                    {t('Allow')}
                </Button>
            </form>

            <form method="post" action={action}>
                {fields}
                <input type="hidden" name="_method" value="DELETE" />
                <Button
                    type="submit"
                    variant="ghost"
                    fullWidth
                    data-test="oauth-deny"
                >
                    {t('Deny')}
                </Button>
            </form>
        </>
    );
}

OAuthAuthorize.layout = {
    title: 'Connect an AI assistant',
};
