import { Avatar, Button } from '@heroui/react';
import { Upload } from 'lucide-react';
import type { ReactNode } from 'react';
import { FileTrigger } from 'react-aria-components';
import { LogoImage } from '@/components/logo-image';
import { useInitials } from '@/hooks/use-initials';
import { useTranslation } from '@/lib/i18n';

type Props = {
    label: string;
    /** "round" for profile pictures, "square" for logos. */
    shape: 'round' | 'square';
    fit?: 'contain' | 'cover';
    /** Current (or newly chosen) image. */
    src: string | null;
    /** Name used for the initials when there is no image. */
    name: string;
    /** Whether there is an image the user may remove (not just a fallback). */
    canRemove: boolean;
    onSelect: (file: File) => void;
    onRemove: () => void;
    isPending?: boolean;
    additionalAction?: ReactNode;
    error?: string;
    'data-test'?: string;
};

/** Accepted formats; the server also checks size and pixel limits. */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Preview, upload/replace and remove for a profile picture or logo. Uploading happens in the
 * callbacks, so the field works for immediate uploads and for forms that send the file on save.
 */
export function ImageUploadField({
    label,
    shape,
    fit,
    src,
    name,
    canRemove,
    onSelect,
    onRemove,
    isPending = false,
    additionalAction,
    error,
    'data-test': dataTest,
}: Props) {
    const { t } = useTranslation();
    const getInitials = useInitials();

    return (
        <div className="grid gap-2" data-test={dataTest}>
            <div className="flex items-center gap-4">
                {shape === 'round' ? (
                    <Avatar className="size-16 shrink-0 text-lg [--avatar-radius:9999px]">
                        {src && (
                            <Avatar.Image
                                src={src}
                                alt=""
                                className="object-cover"
                            />
                        )}
                        <Avatar.Fallback>{getInitials(name)}</Avatar.Fallback>
                    </Avatar>
                ) : (
                    <LogoImage src={src} name={name} size={64} fit={fit} />
                )}
                <div className="grid min-w-0 gap-2">
                    <span className="text-sm font-medium">{label}</span>
                    <div className="flex flex-wrap gap-2">
                        <FileTrigger
                            acceptedFileTypes={ACCEPTED_TYPES}
                            onSelect={(files) => {
                                const file = files?.[0];

                                if (file) {
                                    onSelect(file);
                                }
                            }}
                        >
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                isPending={isPending}
                                data-test="image-upload-choose"
                            >
                                <Upload className="size-4" />
                                {canRemove
                                    ? t('Change image')
                                    : t('Upload image')}
                            </Button>
                        </FileTrigger>
                        {additionalAction}
                        {canRemove && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onPress={onRemove}
                                isDisabled={isPending}
                                data-test="image-upload-remove"
                            >
                                {t('Remove')}
                            </Button>
                        )}
                    </div>
                    <span className="text-xs text-muted">
                        {t('JPG, PNG, WebP or GIF, at most 5 MB.')}
                    </span>
                </div>
            </div>
            {error && (
                <p className="text-sm text-danger" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
