import { Button } from '@heroui/react';
import { Form, Head } from '@inertiajs/react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import { TextInputField } from '@/components/form/text-input-field';
import Heading from '@/components/heading';
import type { Props as ManagePasskeysProps } from '@/components/manage-passkeys';
import ManagePasskeys from '@/components/manage-passkeys';
import type { Props as ManageTwoFactorProps } from '@/components/manage-two-factor';
import ManageTwoFactor from '@/components/manage-two-factor';
import { useTranslation } from '@/lib/i18n';
import { edit } from '@/routes/security';

// oxfmt-ignore
type Props = {
    passwordRules: string;
} & ManagePasskeysProps &
    ManageTwoFactorProps;

export default function Security(props: Props) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Security')} />

            <ManagePasskeys
                canManagePasskeys={props.canManagePasskeys}
                passkeys={props.passkeys}
            />

            {/* Password and two-factor authentication are removed in phase 1 (passwordless). */}
            <section className="grid gap-6">
                <Heading
                    variant="small"
                    title={t('Update password')}
                    description={t('Use a long, random password.')}
                />

                <Form
                    {...SecurityController.update.form()}
                    options={{ preserveScroll: true }}
                    resetOnError={[
                        'password',
                        'password_confirmation',
                        'current_password',
                    ]}
                    resetOnSuccess
                    className="grid gap-4"
                >
                    {({ errors, processing }) => (
                        <>
                            <TextInputField
                                name="current_password"
                                type="password"
                                label={t('Current password')}
                                error={errors.current_password}
                                autoComplete="current-password"
                            />
                            <TextInputField
                                name="password"
                                type="password"
                                label={t('New password')}
                                error={errors.password}
                                autoComplete="new-password"
                                passwordrules={props.passwordRules}
                            />
                            <TextInputField
                                name="password_confirmation"
                                type="password"
                                label={t('Confirm password')}
                                error={errors.password_confirmation}
                                autoComplete="new-password"
                                passwordrules={props.passwordRules}
                            />
                            <div>
                                <Button
                                    type="submit"
                                    isPending={processing}
                                    data-test="update-password-button"
                                >
                                    {t('Save')}
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </section>

            <ManageTwoFactor
                canManageTwoFactor={props.canManageTwoFactor}
                requiresConfirmation={props.requiresConfirmation}
                twoFactorEnabled={props.twoFactorEnabled}
            />
        </>
    );
}

Security.layout = {
    breadcrumbs: [
        {
            title: 'Security',
            href: edit(),
        },
    ],
};
