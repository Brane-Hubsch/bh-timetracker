import { AlertDialog, Button } from '@heroui/react';
import { Form } from '@inertiajs/react';
import { useState } from 'react';
import { TextInputField } from '@/components/form/text-input-field';
import { useTranslation } from '@/lib/i18n';
import { destroy } from '@/routes/organizations';
import type { Organization } from '@/types';

type Props = {
    organization: Organization;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
};

export default function DeleteOrganizationModal({
    organization,
    isOpen,
    onOpenChange,
}: Props) {
    const { t } = useTranslation();
    const [confirmationName, setConfirmationName] = useState('');

    const handleOpenChange = (nextOpen: boolean) => {
        onOpenChange(nextOpen);

        if (!nextOpen) {
            setConfirmationName('');
        }
    };

    return (
        <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange}>
            <AlertDialog.Container>
                <AlertDialog.Dialog className="sm:max-w-md">
                    <Form
                        {...destroy.form(organization.slug)}
                        onSuccess={() => handleOpenChange(false)}
                        className="contents"
                    >
                        {({ errors, processing }) => (
                            <>
                                <AlertDialog.Header>
                                    <AlertDialog.Icon status="danger" />
                                    <AlertDialog.Heading>
                                        {t('Delete organization')}
                                    </AlertDialog.Heading>
                                </AlertDialog.Header>
                                <AlertDialog.Body className="grid gap-4">
                                    <p className="text-sm">
                                        {t(
                                            'This permanently deletes ":name" for all members. It cannot be undone.',
                                            { name: organization.name },
                                        )}
                                    </p>
                                    <TextInputField
                                        name="name"
                                        label={t('Type ":name" to confirm', {
                                            name: organization.name,
                                        })}
                                        value={confirmationName}
                                        onChange={setConfirmationName}
                                        error={errors.name}
                                        autoComplete="off"
                                        data-test="delete-organization-name"
                                    />
                                </AlertDialog.Body>
                                <AlertDialog.Footer>
                                    <Button slot="close" variant="tertiary">
                                        {t('Cancel')}
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="danger"
                                        isDisabled={
                                            confirmationName !==
                                            organization.name
                                        }
                                        isPending={processing}
                                        data-test="delete-organization-confirm"
                                    >
                                        {t('Delete organization')}
                                    </Button>
                                </AlertDialog.Footer>
                            </>
                        )}
                    </Form>
                </AlertDialog.Dialog>
            </AlertDialog.Container>
        </AlertDialog.Backdrop>
    );
}
