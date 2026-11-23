import {
    Button,
    Chip,
    ComboBox,
    Description,
    FieldError,
    Input,
    Label,
    ListBox,
    TextArea,
    TextField,
} from '@heroui/react';
import { Form, useHttp } from '@inertiajs/react';
import { Link2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Group, useFilter } from 'react-aria-components';
import { ImageUploadField } from '@/components/form/image-upload-field';
import { TextInputField } from '@/components/form/text-input-field';
import {
    SideDrawer,
    SideDrawerBody,
    SideDrawerFooter,
    sideDrawerFormClass,
} from '@/components/side-drawer';
import { useTranslation } from '@/lib/i18n';
import { prepareWebsiteLogo, type WebsiteLogo } from '@/lib/website-logo';
import { show, store, update, websiteLogo } from '@/routes/clients';
import type { ClientDetails, ClientNameOption } from '@/types';

type Props = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
} & (
    | { client: ClientDetails; clientNameOptions?: never }
    | { client: null; clientNameOptions: ClientNameOption[] }
);

function ClientNameField({
    options,
    value,
    onChange,
    error,
}: {
    options: ClientNameOption[];
    value: string;
    onChange: (value: string) => void;
    error?: string;
}) {
    const { t } = useTranslation();
    const { contains } = useFilter({ sensitivity: 'base' });

    return (
        <ComboBox
            name="name"
            allowsCustomValue
            inputValue={value}
            onInputChange={onChange}
            selectedKey={null}
            menuTrigger="input"
            defaultFilter={(text, input) => {
                const query = input.trim();
                return query !== '' && contains(text.trim(), query);
            }}
            isInvalid={Boolean(error)}
            isRequired
            validationBehavior="aria"
            className="w-full"
        >
            <Label isRequired>{t('Name')}</Label>
            <Group className="grid gap-1">
                <Input autoFocus autoComplete="off" data-test="client-name" />
                <FieldError>{error}</FieldError>
            </Group>
            <ComboBox.Popover>
                <p
                    aria-hidden="true"
                    className="px-4 pt-2 text-xs font-medium text-muted"
                >
                    {t('Existing clients')}
                </p>
                <ListBox
                    items={options}
                    aria-label={t('Existing clients')}
                    className="max-h-56"
                >
                    {(option: ClientNameOption) => (
                        <ListBox.Item
                            id={option.id}
                            href={show.url({ client: option.id })}
                            textValue={option.name}
                            className="min-h-10 justify-between gap-2 rounded-[1.25rem]"
                        >
                            <span className="min-w-0 font-medium wrap-break-word">
                                {option.name}
                            </span>
                            {option.isArchived && (
                                <Chip
                                    size="sm"
                                    variant="soft"
                                    className="shrink-0"
                                >
                                    {t('Archived')}
                                </Chip>
                            )}
                        </ListBox.Item>
                    )}
                </ListBox>
            </ComboBox.Popover>
        </ComboBox>
    );
}

/** Create or edit a client in a side drawer. */
export function ClientFormDrawer({
    client,
    clientNameOptions = [],
    isOpen,
    onOpenChange,
}: Props) {
    const { t } = useTranslation();
    const form = client ? update.form({ client: client.id }) : store.form();
    const [name, setName] = useState('');
    const normalizedName = name.trim().toLowerCase();
    const duplicate =
        normalizedName !== '' &&
        clientNameOptions.some(
            (option) => option.name.trim().toLowerCase() === normalizedName,
        );
    // The logo is sent with the form: a newly chosen file, or a request to remove the current one.
    const [logo, setLogo] = useState<File | null>(null);
    const [removeLogo, setRemoveLogo] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const savedWebsite = client?.website ?? '';
    const [website, setWebsite] = useState(savedWebsite);
    const [findingLogo, setFindingLogo] = useState(false);
    const [websiteError, setWebsiteError] = useState<string>();
    const [lookupError, setLookupError] = useState<string>();
    const activeLookup = useRef<symbol | null>(null);
    const lookup = useHttp<{ website: string }, { logo: WebsiteLogo | null }>({
        website: '',
    });
    const { cancel: cancelLookup } = lookup;

    useEffect(() => {
        if (isOpen) {
            setName('');
            setLogo(null);
            setRemoveLogo(false);
            setWebsite(savedWebsite);
            setFindingLogo(false);
            setWebsiteError(undefined);
            setLookupError(undefined);
        }

        return () => {
            activeLookup.current = null;
            cancelLookup();
        };
    }, [cancelLookup, isOpen, savedWebsite]);

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

    function clearLogoLookup() {
        activeLookup.current = null;
        cancelLookup();
        setFindingLogo(false);
        setLookupError(undefined);
    }

    async function findLogo() {
        const lookupId = Symbol();
        activeLookup.current = lookupId;
        setFindingLogo(true);
        setWebsiteError(undefined);
        setLookupError(undefined);
        lookup.transform(() => ({ website }));

        try {
            const result = await lookup.submit(websiteLogo(), {
                onError: (errors) => {
                    if (activeLookup.current === lookupId) {
                        setWebsiteError(
                            String(
                                errors.website ??
                                    t('Enter a valid website address.'),
                            ),
                        );
                    }
                },
            });
            if (!result || activeLookup.current !== lookupId) {
                return;
            }
            if (!result.logo) {
                setLookupError(t('No suitable logo found on this website.'));
                return;
            }

            const file = await prepareWebsiteLogo(result.logo);
            if (activeLookup.current === lookupId) {
                setLogo(file);
                setRemoveLogo(false);
            }
        } catch {
            if (activeLookup.current === lookupId) {
                setLookupError(
                    t(
                        'Could not fetch the logo. Try again or upload an image.',
                    ),
                );
            }
        } finally {
            if (activeLookup.current === lookupId) {
                activeLookup.current = null;
                setFindingLogo(false);
            }
        }
    }

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
                onBefore={() => !duplicate}
                onSuccess={() => onOpenChange(false)}
                className={sideDrawerFormClass}
            >
                {({ clearErrors, errors, processing }) => (
                    <>
                        <SideDrawerBody>
                            <div className="grid gap-4">
                                {client ? (
                                    <TextInputField
                                        name="name"
                                        label={t('Name')}
                                        defaultValue={client.name}
                                        error={errors.name}
                                        isRequired
                                        data-test="client-name"
                                    />
                                ) : (
                                    <ClientNameField
                                        options={clientNameOptions}
                                        value={name}
                                        onChange={(value) => {
                                            setName(value);
                                            if (errors.name)
                                                clearErrors('name');
                                        }}
                                        error={
                                            duplicate
                                                ? t(
                                                      'A client with this name already exists.',
                                                  )
                                                : errors.name
                                        }
                                    />
                                )}
                                <TextInputField
                                    name="website"
                                    label={t('Website')}
                                    value={website}
                                    onChange={(value) => {
                                        clearLogoLookup();
                                        setWebsiteError(undefined);
                                        setWebsite(value);
                                    }}
                                    error={websiteError ?? errors.website}
                                    inputMode="url"
                                    enterKeyHint="done"
                                    autoComplete="url"
                                    placeholder={t('example.com')}
                                    data-test="client-website"
                                />
                                <ImageUploadField
                                    label={t('Logo')}
                                    shape="square"
                                    src={logoPreview ?? currentLogo}
                                    name={client?.name ?? '?'}
                                    canRemove={Boolean(logo ?? currentLogo)}
                                    onSelect={(file) => {
                                        clearLogoLookup();
                                        setLogo(file);
                                        setRemoveLogo(false);
                                    }}
                                    onRemove={() => {
                                        clearLogoLookup();
                                        setLogo(null);
                                        setRemoveLogo(true);
                                    }}
                                    additionalAction={
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            isDisabled={
                                                !website.trim() || processing
                                            }
                                            isPending={findingLogo}
                                            onPress={findLogo}
                                            data-test="client-fetch-logo"
                                        >
                                            <Link2 className="size-4" />
                                            {t('Fetch logo')}
                                        </Button>
                                    }
                                    error={lookupError ?? errors.logo}
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
                            <Button
                                type="button"
                                slot="close"
                                variant="tertiary"
                            >
                                {t('Cancel')}
                            </Button>
                            <Button
                                type="submit"
                                isPending={processing}
                                isDisabled={findingLogo || duplicate}
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
