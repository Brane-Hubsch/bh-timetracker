import { Button, Input, toast } from '@heroui/react';
import { Head, router } from '@inertiajs/react';
import { Bot, Copy } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import Heading from '@/components/heading';
import { useOverlayData } from '@/hooks/use-overlay-data';
import { useTranslation } from '@/lib/i18n';
import { formatDate } from '@/lib/time';
import { destroy, edit } from '@/routes/ai-connections';

type Connection = {
    clientId: string;
    name: string;
    connectedAt: string | null;
    lastActiveAt: string | null;
};

type Props = {
    mcpUrl: string;
    connections: Connection[];
};

/**
 * Settings → AI connections: the MCP address, how to add it to Claude and which assistants are
 * connected (with a way to disconnect them).
 */
export default function AiConnections({ mcpUrl, connections }: Props) {
    const { t, intlLocale } = useTranslation();
    const [disconnecting, setDisconnecting] = useState<Connection | null>(null);
    const disconnectTarget = useOverlayData(disconnecting);
    const [isPending, setPending] = useState(false);
    const claudeCodeCommand = `claude mcp add --transport http bh-timetracker ${mcpUrl}`;

    const copy = async (text: string) => {
        await navigator.clipboard.writeText(text);
        toast.success(t('Copied.'));
    };

    const date = (value: string | null) =>
        value
            ? formatDate(value.slice(0, 10), intlLocale, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
              })
            : '–';

    const disconnect = () => {
        if (!disconnecting) {
            return;
        }

        router.delete(destroy.url({ client: disconnecting.clientId }), {
            preserveScroll: true,
            onStart: () => setPending(true),
            onFinish: () => {
                setPending(false);
                setDisconnecting(null);
            },
        });
    };

    return (
        <>
            <Head title={t('AI connections')} />

            <section className="grid gap-4">
                <Heading
                    variant="small"
                    title={t('Connect an AI assistant')}
                    description={t(
                        'Report time and get reports by chatting with Claude or another assistant that supports MCP. The assistant acts as you, with your permissions.',
                    )}
                />

                <div className="grid gap-2">
                    <span className="text-sm font-medium">
                        {t('MCP address')}
                    </span>
                    <div className="flex gap-2">
                        <Input
                            readOnly
                            value={mcpUrl}
                            aria-label={t('MCP address')}
                            className="min-w-0 flex-1 font-mono"
                            data-test="mcp-url"
                        />
                        <Button
                            variant="secondary"
                            isIconOnly
                            aria-label={t('Copy')}
                            onPress={() => copy(mcpUrl)}
                        >
                            <Copy className="size-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 rounded-2xl bg-surface p-4 text-sm shadow-surface">
                    <div className="grid gap-1">
                        <h3 className="font-medium">
                            {t('Claude (web, desktop and mobile)')}
                        </h3>
                        <ol className="list-decimal space-y-1 pl-5 text-muted">
                            <li>
                                {t(
                                    'Open Settings → Connectors and choose "Add custom connector".',
                                )}
                            </li>
                            <li>
                                {t(
                                    'Name it BH Timetracker and paste the MCP address.',
                                )}
                            </li>
                            <li>
                                {t(
                                    'Choose Connect, sign in here and allow access.',
                                )}
                            </li>
                        </ol>
                    </div>

                    <div className="grid gap-1">
                        <h3 className="font-medium">{t('Claude Code')}</h3>
                        <p className="text-muted">
                            {t(
                                'Run this in a terminal, then type /mcp in Claude Code to sign in:',
                            )}
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-default px-3 py-2 font-mono text-xs whitespace-nowrap">
                                {claudeCodeCommand}
                            </code>
                            <Button
                                variant="ghost"
                                size="sm"
                                isIconOnly
                                aria-label={t('Copy')}
                                onPress={() => copy(claudeCodeCommand)}
                            >
                                <Copy className="size-4" />
                            </Button>
                        </div>
                    </div>

                    <p className="text-muted">
                        {t(
                            'Other MCP clients: use the address above with OAuth sign-in (streamable HTTP).',
                        )}
                    </p>
                </div>
            </section>

            <section className="grid gap-4">
                <Heading variant="small" title={t('Connected assistants')} />

                {connections.length === 0 ? (
                    <p className="rounded-2xl bg-surface p-4 text-sm text-muted shadow-surface">
                        {t('No AI assistant is connected yet.')}
                    </p>
                ) : (
                    <ul
                        className="divide-y divide-separator rounded-2xl bg-surface shadow-surface"
                        data-test="ai-connections"
                    >
                        {connections.map((connection) => (
                            <li
                                key={connection.clientId}
                                className="flex items-center gap-3 px-4 py-3"
                            >
                                <Bot className="size-5 shrink-0 text-accent" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                        {connection.name}
                                    </p>
                                    <p className="text-xs text-muted">
                                        {t(
                                            'Connected :connected · last active :active',
                                            {
                                                connected: date(
                                                    connection.connectedAt,
                                                ),
                                                active: date(
                                                    connection.lastActiveAt,
                                                ),
                                            },
                                        )}
                                    </p>
                                </div>
                                <Button
                                    variant="danger-soft"
                                    size="sm"
                                    onPress={() => setDisconnecting(connection)}
                                    data-test="ai-connection-disconnect"
                                >
                                    {t('Disconnect')}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <ConfirmDialog
                isOpen={disconnecting !== null}
                onOpenChange={(isOpen) => !isOpen && setDisconnecting(null)}
                title={t('Disconnect :name?', {
                    name: disconnectTarget?.name ?? '',
                })}
                confirmLabel={t('Disconnect')}
                onConfirm={disconnect}
                isPending={isPending}
            >
                {t(
                    'The assistant loses access right away. You can connect it again later.',
                )}
            </ConfirmDialog>
        </>
    );
}

AiConnections.layout = {
    breadcrumbs: [
        {
            title: 'AI connections',
            href: edit(),
        },
    ],
};
