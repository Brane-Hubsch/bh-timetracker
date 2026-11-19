import { Button, Description, Label, TextArea, TextField } from '@heroui/react';
import { Form } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { ImageUploadField } from '@/components/form/image-upload-field';
import { TextInputField } from '@/components/form/text-input-field';
import {
    SideDrawer,
    SideDrawerBody,
    SideDrawerFooter,
    sideDrawerFormClass,
} from '@/components/side-drawer';
import { useTranslation } from '@/lib/i18n';
import { store, update } from '@/routes/clients';
import type { ClientDetails } from '@/types';

type Props = {
    /** Edit this client, or create a new one when null. */
    client: ClientDetails | null;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
};

/** Create or edit a client in a side drawer. */
export function ClientFormDrawer({ client, isOpen, onOpenChange }: Props) {
    const { t } = useTranslation();
    const form = client ? update.form({ client: client.id }) : store.form();
    // The logo is sent with the form: a newly chosen file, or a request to remove the current one.
    const [logo, setLogo] = useState<File | null>(null);
    const [removeLogo, setRemoveLogo] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setLogo(null);
            setRemoveLogo(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!logo) {
            setLogoPreview(null);

            return;
        }

        const url = URL.createObjectURL(logo);
        setLogoPreview(url);

        return () => URL.revokeObjectURL(url);
    }, [logo]);

    const currentLogo = removeLogo ? null : (client?.logo ?? null);

    return (
        <SideDrawer
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title={client ? t('Edit client') : t('New client')}
        >
            <Form
                {...form}
                options={{ preserveScroll: true }}
                transform={(data) => ({
                    ...data,
                    ...(logo ? { logo } : {}),
                    remove_logo: removeLogo ? 1 : 0,
                })}
                onSuccess={() => onOpenChange(false)}
                className={sideDrawerFormClass}
            >
                {({ errors, processing }) => (
                    <>
                        <SideDrawerBody>
                            <div className="grid gap-4">
                                <TextInputField
                                    name="name"
                                    label={t('Name')}
                                    defaultValue={client?.name}
                                    error={errors.name}
                                    isRequired
                                    autoFocus={!client}
                                    data-test="client-name"
                                />
                                <ImageUploadField
                                    label={t('Logo')}
                                    shape="square"
                                    src={logoPreview ?? currentLogo}
                                    name={client?.name ?? '?'}
                                    canRemove={Boolean(logo ?? currentLogo)}
                                    onSelect={(file) => {
                                        setLogo(file);
                                        setRemoveLogo(false);
                                    }}
                                    onRemove={() => {
                                        setLogo(null);
                                        setRemoveLogo(true);
                                    }}
                                    error={errors.logo}
                                    data-test="client-logo"
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
                                    <TextArea rows={4} />
                                    {errors.notes && (
                                        <Description className="text-danger">
                                            {errors.notes}
                                        </Description>
                                    )}
                                </TextField>
                            </div>
                        </SideDrawerBody>
                        <SideDrawerFooter>
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
                        </SideDrawerFooter>
                    </>
                )}
            </Form>
        </SideDrawer>
    );
}
