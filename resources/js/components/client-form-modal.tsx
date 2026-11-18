import {
    Button,
    Description,
    Label,
    Modal,
    TextArea,
    TextField,
} from '@heroui/react';
import { Form } from '@inertiajs/react';
import { TextInputField } from '@/components/form/text-input-field';
import { useTranslation } from '@/lib/i18n';
import { store, update } from '@/routes/clients';
import type { ClientDetails } from '@/types';

type Props = {
    /** Edit this client, or create a new one when null. */
    client: ClientDetails | null;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
};

export function ClientFormModal({ client, isOpen, onOpenChange }: Props) {
    const { t } = useTranslation();
    const form = client ? update.form({ client: client.id }) : store.form();

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-lg">
                    <Form
                        {...form}
                        options={{ preserveScroll: true }}
                        onSuccess={() => onOpenChange(false)}
                        className="contents"
                    >
                        {({ errors, processing }) => (
                            <>
                                <Modal.Header>
                                    <Modal.Heading>
                                        {client
                                            ? t('Edit client')
                                            : t('New client')}
                                    </Modal.Heading>
                                </Modal.Header>
                                <Modal.Body className="grid gap-4">
                                    <TextInputField
                                        name="name"
                                        label={t('Name')}
                                        defaultValue={client?.name}
                                        error={errors.name}
                                        isRequired
                                        autoFocus
                                        data-test="client-name"
                                    />
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <TextInputField
                                            name="organization_number"
                                            label={t('Organization number')}
                                            defaultValue={
                                                client?.organizationNumber ?? ''
                                            }
                                            error={errors.organization_number}
                                        />
                                        <TextInputField
                                            name="email"
                                            type="email"
                                            label={t('Email address')}
                                            defaultValue={client?.email ?? ''}
                                            error={errors.email}
                                        />
                                    </div>
                                    <TextField
                                        name="notes"
                                        defaultValue={client?.notes ?? ''}
                                        isInvalid={Boolean(errors.notes)}
                                        className="w-full"
                                    >
                                        <Label>{t('Notes')}</Label>
                                        <TextArea rows={3} />
                                        {errors.notes && (
                                            <Description className="text-danger">
                                                {errors.notes}
                                            </Description>
                                        )}
                                    </TextField>
                                </Modal.Body>
                                <Modal.Footer>
                                    <Button slot="close" variant="tertiary">
                                        {t('Cancel')}
                                    </Button>
                                    <Button
                                        type="submit"
                                        isPending={processing}
                                        data-test="client-save"
                                    >
                                        {t('Save')}
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
