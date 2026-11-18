import { Button, Chip } from '@heroui/react';
import { KeyRound, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useTranslation } from '@/lib/i18n';
import type { Passkey } from '@/types/auth';

type Props = {
    passkey: Passkey;
    onDelete: (id: number, onFinish: () => void) => void;
};

export default function PasskeyItem({ passkey, onDelete }: Props) {
    const { t } = useTranslation();
    const [isConfirmOpen, setConfirmOpen] = useState(false);
    const [isDeleting, setDeleting] = useState(false);

    const handleDelete = () => {
        setDeleting(true);
        onDelete(passkey.id, () => {
            setDeleting(false);
            setConfirmOpen(false);
        });
    };

    return (
        <li className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
                <KeyRound className="size-5 shrink-0 text-muted" />
                <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                            {passkey.name}
                        </span>
                        {passkey.authenticator && (
                            <Chip size="sm" variant="soft">
                                {passkey.authenticator}
                            </Chip>
                        )}
                    </div>
                    <p className="text-sm text-muted">
                        {t('Added :time', { time: passkey.created_at_diff })}
                        {passkey.last_used_at_diff &&
                            ` · ${t('Last used :time', {
                                time: passkey.last_used_at_diff,
                            })}`}
                    </p>
                </div>
            </div>

            <Button
                isIconOnly
                variant="ghost"
                size="sm"
                aria-label={t('Remove passkey')}
                onPress={() => setConfirmOpen(true)}
            >
                <Trash2 className="size-4 text-danger" />
            </Button>

            <ConfirmDialog
                isOpen={isConfirmOpen}
                onOpenChange={setConfirmOpen}
                title={t('Remove passkey')}
                confirmLabel={t('Remove passkey')}
                onConfirm={handleDelete}
                isPending={isDeleting}
            >
                <p className="text-sm">
                    {t('You will no longer be able to sign in with ":name".', {
                        name: passkey.name,
                    })}
                </p>
            </ConfirmDialog>
        </li>
    );
}
