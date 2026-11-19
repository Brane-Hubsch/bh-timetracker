import { AlertDialog, Button } from '@heroui/react';
import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';

type ConfirmDialogProps = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: ReactNode;
    children: ReactNode;
    confirmLabel: ReactNode;
    onConfirm: () => void;
    isPending?: boolean;
    status?: 'danger' | 'warning' | 'accent';
    'data-test'?: string;
};

/**
 * Confirmation dialog for destructive or important actions.
 */
export function ConfirmDialog({
    isOpen,
    onOpenChange,
    title,
    children,
    confirmLabel,
    onConfirm,
    isPending = false,
    status = 'danger',
    'data-test': dataTest,
}: ConfirmDialogProps) {
    const { t } = useTranslation();

    return (
        <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <AlertDialog.Container>
                <AlertDialog.Dialog className="sm:max-w-md">
                    <AlertDialog.Header>
                        <AlertDialog.Icon status={status} />
                        <AlertDialog.Heading>{title}</AlertDialog.Heading>
                    </AlertDialog.Header>
                    <AlertDialog.Body>{children}</AlertDialog.Body>
                    <AlertDialog.Footer>
                        <Button slot="close" variant="tertiary">
                            {t('Cancel')}
                        </Button>
                        <Button
                            variant={status === 'danger' ? 'danger' : 'primary'}
                            isPending={isPending}
                            onPress={onConfirm}
                            data-test={dataTest}
                        >
                            {confirmLabel}
                        </Button>
                    </AlertDialog.Footer>
                </AlertDialog.Dialog>
            </AlertDialog.Container>
        </AlertDialog.Backdrop>
    );
}
