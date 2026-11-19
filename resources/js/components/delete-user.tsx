import { AlertDialog, Button } from '@heroui/react';
import { Form } from '@inertiajs/react';
import { useState } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import { TextInputField } from '@/components/form/text-input-field';
import Heading from '@/components/heading';
import { useTranslation } from '@/lib/i18n';

export default function DeleteUser() {
    const { t } = useTranslation();
    const [isOpen, setOpen] = useState(false);

    return (
        <section className="grid gap-4 rounded-2xl border border-danger/30 p-4">
            <Heading
                variant="small"
                title={t('Delete account')}
                description={t(
                    'Permanently deletes your account. This cannot be undone.',
                )}
            />
            <div>
                <Button
                    variant="danger-soft"
                    onPress={() => setOpen(true)}
                    data-test="delete-user-button"
                >
                    {t('Delete account')}
                </Button>
            </div>

            <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={setOpen}>
                <AlertDialog.Container>
                    <AlertDialog.Dialog className="sm:max-w-md">
                        <Form
                            {...ProfileController.destroy.form()}
                            options={{ preserveScroll: true }}
                            resetOnSuccess
                            onSuccess={() => setOpen(false)}
                            className="contents"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <AlertDialog.Header>
                                        <AlertDialog.Icon status="danger" />
                                        <AlertDialog.Heading>
                                            {t('Delete your account?')}
                                        </AlertDialog.Heading>
                                    </AlertDialog.Header>
                                    <AlertDialog.Body className="grid gap-4">
                                        <p className="text-sm">
                                            {t(
                                                'All of your data will be permanently deleted. Type your email address to confirm.',
                                            )}
                                        </p>
                                        <TextInputField
                                            name="email"
                                            type="email"
                                            label={t('Email address')}
                                            error={errors.email}
                                            autoComplete="off"
                                            autoFocus
                                            data-test="delete-user-email"
                                        />
                                    </AlertDialog.Body>
                                    <AlertDialog.Footer>
                                        <Button slot="close" variant="tertiary">
                                            {t('Cancel')}
                                        </Button>
                                        <Button
                                            type="submit"
                                            variant="danger"
                                            isPending={processing}
                                            data-test="confirm-delete-user-button"
                                        >
                                            {t('Delete account')}
                                        </Button>
                                    </AlertDialog.Footer>
                                </>
                            )}
                        </Form>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </section>
    );
}
