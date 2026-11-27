import { Button, Chip, Dropdown, Label, Modal } from '@heroui/react';
import { Form } from '@inertiajs/react';
import { EllipsisVertical, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { HapticButton } from '@/components/haptic-button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { TextInputField } from '@/components/form/text-input-field';
import { useTranslation } from '@/lib/i18n';
import { rename } from '@/routes/passkeys';
import type { Passkey } from '@/types/auth';

type Props = {
    passkey: Passkey;
    onDelete: (id: number, onFinish: () => void) => void;
};

export default function PasskeyItem({ passkey, onDelete }: Props) {
    const { t } = useTranslation();
    const [isRenameOpen, setRenameOpen] = useState(false);
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
        <li
            className="flex items-center justify-between gap-4 p-4"
            data-test="passkey-row"
        >
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

            <Dropdown>
                <Button
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    aria-label={t('Passkey actions')}
                    data-test="passkey-actions"
                >
                    <EllipsisVertical className="size-4" />
                </Button>
                <Dropdown.Popover placement="bottom end">
                    <Dropdown.Menu
                        onAction={(key) =>
                            key === 'rename'
                                ? setRenameOpen(true)
                                : setConfirmOpen(true)
                        }
                    >
                        <Dropdown.Item id="rename" textValue={t('Rename')}>
                            <Label>{t('Rename')}</Label>
                        </Dropdown.Item>
                        <Dropdown.Item
                            id="remove"
                            textValue={t('Remove passkey')}
                            variant="danger"
                        >
                            <Label>{t('Remove passkey')}</Label>
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown.Popover>
            </Dropdown>

            <Modal.Backdrop isOpen={isRenameOpen} onOpenChange={setRenameOpen}>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-md">
                        <Form
                            {...rename.form(passkey.id)}
                            options={{ preserveScroll: true }}
                            onSuccess={() => setRenameOpen(false)}
                            className="contents"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <Modal.Header>
                                        <Modal.Heading>
                                            {t('Rename passkey')}
                                        </Modal.Heading>
                                    </Modal.Header>
                                    <Modal.Body>
                                        <TextInputField
                                            name="name"
                                            label={t('Passkey name')}
                                            defaultValue={passkey.name}
                                            error={errors.name}
                                            isRequired
                                            autoFocus
                                        />
                                    </Modal.Body>
                                    <Modal.Footer>
                                        <HapticButton
                                            slot="close"
                                            variant="tertiary"
                                        >
                                            {t('Cancel')}
                                        </HapticButton>
                                        <HapticButton
                                            type="submit"
                                            isPending={processing}
                                        >
                                            {t('Save')}
                                        </HapticButton>
                                    </Modal.Footer>
                                </>
                            )}
                        </Form>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>

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
