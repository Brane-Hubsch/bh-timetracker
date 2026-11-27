import { Button, Modal } from '@heroui/react';
import { Form } from '@inertiajs/react';
import { HapticButton } from '@/components/haptic-button';
import { TextInputField } from '@/components/form/text-input-field';
import { useTranslation } from '@/lib/i18n';
import { store } from '@/routes/organizations';

type Props = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
};

export default function CreateOrganizationModal({
    isOpen,
    onOpenChange,
}: Props) {
    const { t } = useTranslation();

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Form
                        {...store.form()}
                        onSuccess={() => onOpenChange(false)}
                        className="contents"
                    >
                        {({ errors, processing }) => (
                            <>
                                <Modal.Header>
                                    <Modal.Heading>
                                        {t('Create a new organization')}
                                    </Modal.Heading>
                                </Modal.Header>
                                <Modal.Body className="grid gap-4">
                                    <p className="text-sm text-muted">
                                        {t(
                                            'Organizations keep clients, projects and time separate.',
                                        )}
                                    </p>
                                    <TextInputField
                                        name="name"
                                        label={t('Organization name')}
                                        error={errors.name}
                                        isRequired
                                        autoFocus
                                        data-test="create-organization-name"
                                    />
                                </Modal.Body>
                                <Modal.Footer>
                                    <HapticButton
                                        slot="close"
                                        variant="tertiary"
                                    >
                                        {t('Cancel')}
                                    </HapticButton>
                                    <Button
                                        type="submit"
                                        isPending={processing}
                                        data-test="create-organization-submit"
                                    >
                                        {t('Create organization')}
                                    </Button>
                                </Modal.Footer>
                            </>
                        )}
                    </Form>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
