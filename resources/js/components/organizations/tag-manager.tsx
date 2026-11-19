import { Button } from '@heroui/react';
import { Form, router } from '@inertiajs/react';
import { Pencil, Tag as TagIcon, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { TextInputField } from '@/components/form/text-input-field';
import Heading from '@/components/heading';
import { ResponsiveDialog } from '@/components/responsive-dialog';
import { useTranslation } from '@/lib/i18n';
import { destroy, store, update } from '@/routes/organizations/tags';

export type OrganizationTag = {
    id: number;
    name: string;
    entryCount: number;
};

type Props = {
    organizationSlug: string;
    tags: OrganizationTag[];
};

const RENAME_FORM = 'rename-tag-form';

/**
 * The organization's tags for owners and admins: add, rename (renaming to an existing name merges
 * the two) and delete. Members create tags while reporting time.
 */
export function TagManager({ organizationSlug, tags }: Props) {
    const { t, tc } = useTranslation();
    const [renaming, setRenaming] = useState<OrganizationTag | null>(null);
    const [deleting, setDeleting] = useState<OrganizationTag | null>(null);
    const [isDeletePending, setDeletePending] = useState(false);

    return (
        <section
            id="tags"
            className="grid scroll-mt-6 gap-4"
            data-test="tag-manager"
        >
            <Heading
                variant="small"
                title={t('Tags')}
                description={t(
                    'Everyone can add tags when reporting time. Renaming a tag to the name of another merges them.',
                )}
            />

            <Form
                {...store.form({ organization: organizationSlug })}
                options={{ preserveScroll: true }}
                resetOnSuccess
                className="flex items-start gap-2"
            >
                {({ errors, processing }) => (
                    <>
                        <TextInputField
                            name="name"
                            label={
                                <span className="sr-only">{t('New tag')}</span>
                            }
                            placeholder={t('New tag')}
                            error={errors.name}
                            className="w-full max-w-xs"
                            data-test="new-tag-name"
                        />
                        <Button
                            type="submit"
                            variant="secondary"
                            isPending={processing}
                            data-test="add-tag-button"
                        >
                            {t('Add')}
                        </Button>
                    </>
                )}
            </Form>

            <ul className="divide-y divide-separator rounded-2xl bg-surface shadow-surface">
                {tags.map((tag) => (
                    <li
                        key={tag.id}
                        className="flex items-center gap-3 px-4 py-3"
                        data-test="tag-row"
                    >
                        <TagIcon className="size-4 shrink-0 text-muted" />
                        <span className="min-w-0 flex-1 truncate font-medium">
                            {tag.name}
                        </span>
                        <span className="text-sm text-muted tabular-nums">
                            {tc(':count entry|:count entries', tag.entryCount, {
                                count: tag.entryCount,
                            })}
                        </span>
                        <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            aria-label={t('Rename :name', { name: tag.name })}
                            onPress={() => setRenaming(tag)}
                        >
                            <Pencil className="size-4" />
                        </Button>
                        <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            aria-label={t('Delete :name', { name: tag.name })}
                            onPress={() => setDeleting(tag)}
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </li>
                ))}
                {tags.length === 0 && (
                    <li className="p-6 text-center text-sm text-muted">
                        {t('No tags yet.')}
                    </li>
                )}
            </ul>

            <ResponsiveDialog
                isOpen={renaming !== null}
                onOpenChange={(isOpen) => !isOpen && setRenaming(null)}
                title={t('Rename tag')}
                footer={
                    <>
                        <Button slot="close" variant="tertiary">
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" form={RENAME_FORM}>
                            {t('Save')}
                        </Button>
                    </>
                }
            >
                {renaming && (
                    <Form
                        {...update.form({
                            organization: organizationSlug,
                            tag: renaming.id,
                        })}
                        id={RENAME_FORM}
                        options={{ preserveScroll: true }}
                        onSuccess={() => setRenaming(null)}
                    >
                        {({ errors }) => (
                            <TextInputField
                                name="name"
                                label={t('Name')}
                                defaultValue={renaming.name}
                                error={errors.name}
                                autoFocus
                                data-test="rename-tag-name"
                            />
                        )}
                    </Form>
                )}
            </ResponsiveDialog>

            <ConfirmDialog
                isOpen={deleting !== null}
                onOpenChange={(isOpen) => !isOpen && setDeleting(null)}
                title={t('Delete tag')}
                confirmLabel={t('Delete')}
                isPending={isDeletePending}
                onConfirm={() => {
                    if (!deleting) {
                        return;
                    }

                    router.delete(
                        destroy.url({
                            organization: organizationSlug,
                            tag: deleting.id,
                        }),
                        {
                            preserveScroll: true,
                            onStart: () => setDeletePending(true),
                            onFinish: () => setDeletePending(false),
                            onSuccess: () => setDeleting(null),
                        },
                    );
                }}
            >
                {deleting &&
                    tc(
                        'The tag ":name" is removed from :count entry. The entry is kept.|The tag ":name" is removed from :count entries. The entries are kept.',
                        deleting.entryCount,
                        { name: deleting.name, count: deleting.entryCount },
                    )}
            </ConfirmDialog>
        </section>
    );
}
