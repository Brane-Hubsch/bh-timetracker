import { Button } from '@heroui/react';
import { Form, useFormContext } from '@inertiajs/react';
import { HapticButton } from '@/components/haptic-button';
import { SelectField } from '@/components/form/select-field';
import { TextInputField } from '@/components/form/text-input-field';
import { ResponsiveDialog } from '@/components/responsive-dialog';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
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
        <ResponsiveDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title={t('Invite a member')}
            desktopClassName="sm:max-w-md"
            showDesktopClose={false}
            headingClassName="max-md:text-lg/7 max-md:font-semibold"
            mobileClassName="[&_.drawer__footer]:gap-3"
            wrapContent={(content) => (
                <Form
                    {...storeInvitation.form(organization.slug)}
                    onSuccess={() => onOpenChange(false)}
                    className="contents"
                >
                    {content}
                </Form>
            )}
            footer={<InviteActions />}
        >
            <InviteFields availableRoles={availableRoles} fromTeam={fromTeam} />
        </ResponsiveDialog>
    );
}

function InviteFields({
    availableRoles,
    fromTeam,
}: Pick<Props, 'availableRoles' | 'fromTeam'>) {
    const { t } = useTranslation();
    const form = useFormContext<{ email: string; role: string }>();

    return (
        <div className="grid gap-4">
            {fromTeam && <input type="hidden" name="from_team" value="1" />}
            <TextInputField
                name="email"
                type="email"
                label={t('Email address')}
                error={form?.errors.email}
                isRequired
                autoFocus
                data-test="invite-email"
            />
            <SelectField
                name="role"
                label={t('Role')}
                defaultValue="member"
                options={availableRoles}
                error={form?.errors.role}
                data-test="invite-role"
            />
        </div>
    );
}

function InviteActions() {
    const { t } = useTranslation();
    const form = useFormContext();
    const buttonLayoutClassName = 'max-md:min-w-0 max-md:flex-1';
    const buttonClassName =
        'max-md:min-w-0 max-md:px-1 max-md:leading-tight max-md:whitespace-normal';

    return (
        <>
            <HapticButton
                slot="close"
                variant="tertiary"
                containerClassName={buttonLayoutClassName}
                className={buttonClassName}
            >
                {t('Cancel')}
            </HapticButton>
            <Button
                type="submit"
                isPending={form?.processing}
                className={cn(buttonLayoutClassName, buttonClassName)}
                data-test="invite-submit"
            >
                {t('Send invitation')}
            </Button>
        </>
    );
}
