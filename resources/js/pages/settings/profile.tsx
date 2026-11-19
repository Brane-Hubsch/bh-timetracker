import { Button } from '@heroui/react';
import { Form, Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/delete-user';
import { ImageUploadField } from '@/components/form/image-upload-field';
import { TextInputField } from '@/components/form/text-input-field';
import Heading from '@/components/heading';
import { useTranslation } from '@/lib/i18n';
import { edit } from '@/routes/profile';
import {
    destroy as destroyAvatar,
    update as updateAvatar,
} from '@/routes/profile/avatar';
import { send } from '@/routes/verification';

export default function Profile({
    mustVerifyEmail,
    avatar,
    status,
}: {
    mustVerifyEmail: boolean;
    /** The uploaded picture (preview size) and the Google picture shown without it. */
    avatar: { uploaded: string | null; fallback: string | null };
    status?: string;
}) {
    const { t } = useTranslation();
    const { auth } = usePage().props;
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [isUploading, setUploading] = useState(false);

    const visit = {
        preserveScroll: true,
        onStart: () => setUploading(true),
        onFinish: () => setUploading(false),
    };

    return (
        <>
            <Head title={t('Profile')} />

            <section className="grid gap-6">
                <Heading
                    variant="small"
                    title={t('Profile picture')}
                    description={t(
                        'Shown to your colleagues in the app. Without one, your Google picture or your initials are shown.',
                    )}
                />
                <ImageUploadField
                    label={t('Profile picture')}
                    shape="round"
                    src={avatar.uploaded ?? avatar.fallback}
                    name={auth.user.name}
                    canRemove={avatar.uploaded !== null}
                    onSelect={(image) =>
                        router.post(
                            updateAvatar.url(),
                            { image },
                            { ...visit, forceFormData: true },
                        )
                    }
                    onRemove={() => router.delete(destroyAvatar.url(), visit)}
                    isPending={isUploading}
                    error={errors.image}
                    data-test="profile-avatar"
                />
            </section>

            <section className="grid gap-6">
                <Heading
                    variant="small"
                    title={t('Profile')}
                    description={t('Your name and email address.')}
                />

                <Form
                    {...ProfileController.update.form()}
                    options={{ preserveScroll: true }}
                    className="grid gap-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <TextInputField
                                name="name"
                                label={t('Name')}
                                defaultValue={auth.user.name}
                                error={errors.name}
                                isRequired
                                autoComplete="name"
                            />
                            <TextInputField
                                name="email"
                                type="email"
                                label={t('Email address')}
                                defaultValue={auth.user.email}
                                error={errors.email}
                                isRequired
                                autoComplete="username"
                            />

                            {mustVerifyEmail &&
                                auth.user.email_verified_at === null && (
                                    <p className="text-sm text-muted">
                                        {t('Your email address is unverified.')}{' '}
                                        <Link
                                            href={send()}
                                            as="button"
                                            className="text-foreground underline underline-offset-4"
                                        >
                                            {t(
                                                'Resend the verification email.',
                                            )}
                                        </Link>
                                        {status ===
                                            'verification-link-sent' && (
                                            <span className="mt-2 block font-medium text-success">
                                                {t(
                                                    'A new verification link has been sent to your email address.',
                                                )}
                                            </span>
                                        )}
                                    </p>
                                )}

                            <div>
                                <Button
                                    type="submit"
                                    isPending={processing}
                                    data-test="update-profile-button"
                                >
                                    {t('Save')}
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </section>

            <DeleteUser />
        </>
    );
}

Profile.layout = {
    breadcrumbs: [
        {
            title: 'Profile',
            href: edit(),
        },
    ],
};
