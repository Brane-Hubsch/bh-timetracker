import { Button, Modal } from '@heroui/react';
import { Form } from '@inertiajs/react';
import { SelectField } from '@/components/form/select-field';
import { TextInputField } from '@/components/form/text-input-field';
import { useTranslation } from '@/lib/i18n';
import { store as storeInvitation } from '@/routes/organizations/invitations';
import type { Organization, RoleOption } from '@/types';

type Props = {
    organization: Organization;
    availableRoles: RoleOption[];
    isOpen: boolean;
    fromTeam?: boolean;
    onOpenChange: (isOpen: boolean) => void;
};

export default function InviteMemberModal({
    organization,
    availableRoles,
    isOpen,
    fromTeam = false,
    onOpenChange,
}: Props) {
    const { t } = useTranslation();

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Form
                        {...storeInvitation.form(organization.slug)}
                        onSuccess={() => onOpenChange(false)}
                        className="contents"
                    >
                        {({ errors, processing }) => (
                            <>
                                <Modal.Header>
                                    <Modal.Heading>
                                        {t('Invite a member')}
                                    </Modal.Heading>
                                </Modal.Header>
                                <Modal.Body className="grid gap-4">
                                    {fromTeam && (
                                        <input
                                            type="hidden"
                                            name="from_team"
                                            value="1"
                                        />
                                    )}
                                    <TextInputField
                                        name="email"
                                        type="email"
                                        label={t('Email address')}
                                        error={errors.email}
                                        isRequired
                                        autoFocus
                                        data-test="invite-email"
                                    />
                                    <SelectField
                                        name="role"
                                        label={t('Role')}
                                        defaultValue="member"
                                        options={availableRoles}
                                        error={errors.role}
                                        data-test="invite-role"
                                    />
                                </Modal.Body>
                                <Modal.Footer>
                                    <Button slot="close" variant="tertiary">
                                        {t('Cancel')}
                                    </Button>
                                    <Button
                                        type="submit"
                                        isPending={processing}
                                        data-test="invite-submit"
                                    >
                                        {t('Send invitation')}
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
