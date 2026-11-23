import { Button, Dropdown, Label, SearchField } from '@heroui/react';
import { Form, Head, router } from '@inertiajs/react';
import {
    EllipsisVertical,
    Pencil,
    Tag as TagIcon,
    Tags,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { TextInputField } from '@/components/form/text-input-field';
import Heading from '@/components/heading';
import { ResponsiveDialog } from '@/components/responsive-dialog';
import { formatHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { formatDate } from '@/lib/time';
import { destroy, store, update } from '@/routes/tags';

type OrganizationTag = {
    id: number;
    name: string;
    entryCount: number;
    reportedSeconds: number;
    /** Local date (YYYY-MM-DD) the tag was last used on, or null. */
    lastUsedOn: string | null;
};

type Props = {
    tags: OrganizationTag[];
};

/** Columns from lg up: tag, entries, reported, last used, actions. */
const COLUMNS =
    'lg:grid-cols-[minmax(0,1fr)_7rem_8rem_8.5rem_2.5rem] lg:items-center lg:gap-4';

const RENAME_FORM = 'rename-tag-form';

/**
 * The organization's tags for owners and admins, with their usage: add, search, rename (renaming to
 * an existing name merges the two) and delete. Members create tags while reporting time.
 */
export default function TagsIndex({ tags }: Props) {
    const { t, tc, intlLocale } = useTranslation();
    const [search, setSearch] = useState('');
    const query = search.trim().toLocaleLowerCase();
    const visible = query
        ? tags.filter((tag) => tag.name.toLocaleLowerCase().includes(query))
        : tags;
    const [renaming, setRenaming] = useState<OrganizationTag | null>(null);
    const [deleting, setDeleting] = useState<OrganizationTag | null>(null);
    const [isDeletePending, setDeletePending] = useState(false);

    return (
        <>
            <Head title={t('Tags')} />

            <div className="grid gap-6" data-test="tag-manager">
                <Heading
                    title={t('Tags')}
                    description={t(
                        'Everyone can add tags when reporting time. Renaming a tag to the name of another merges them.',
                    )}
                />

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <SearchField
                        aria-label={t('Search tags')}
                        value={search}
                        onChange={setSearch}
                        className="w-full sm:max-w-xs"
                    >
                        <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder={t('Search tags')} />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>

                    <Form
                        {...store.form()}
                        options={{ preserveScroll: true }}
                        resetOnSuccess
                        className="flex items-start gap-2"
                    >
                        {({ errors, processing }) => (
                            <>
                                <TextInputField
                                    name="name"
                                    label={
                                        <span className="sr-only">
                                            {t('New tag')}
                                        </span>
                                    }
                                    placeholder={t('New tag')}
                                    error={errors.name}
                                    className="w-full sm:w-60"
                                    data-test="new-tag-name"
                                />
                                <Button
                                    type="submit"
                                    isPending={processing}
                                    className="shrink-0"
                                    data-test="add-tag-button"
                                >
                                    {t('Add')}
                                </Button>
                            </>
                        )}
                    </Form>
                </div>

                <div className="overflow-hidden rounded-2xl bg-surface shadow-surface">
                    {visible.length > 0 && (
                        <div
                            aria-hidden="true"
                            className={`hidden border-b border-separator py-2.5 ps-5 pe-3 text-xs font-medium text-muted lg:grid ${COLUMNS}`}
                        >
                            <span>{t('Tag')}</span>
                            <span className="text-right">{t('Entries')}</span>
                            <span className="text-right">{t('Reported')}</span>
                            <span className="text-right">{t('Last used')}</span>
                            <span />
                        </div>
                    )}
                    <ul className="divide-y divide-separator">
                        {visible.map((tag) => (
                            <li
                                key={tag.id}
                                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2.5 ps-4 pe-2 lg:py-2 lg:ps-5 lg:pe-3 ${COLUMNS}`}
                                data-test="tag-row"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <TagIcon className="size-4 shrink-0 text-muted" />
                                    <div className="min-w-0">
                                        <p className="truncate font-medium">
                                            {tag.name}
                                        </p>
                                        {/* On mobile the usage sits under the name. */}
                                        <p className="truncate text-xs text-muted lg:hidden">
                                            {[
                                                tc(
                                                    ':count entry|:count entries',
                                                    tag.entryCount,
                                                    { count: tag.entryCount },
                                                ),
                                                tag.entryCount > 0 &&
                                                    formatHours(
                                                        tag.reportedSeconds,
                                                        intlLocale,
                                                    ),
                                                tag.lastUsedOn &&
                                                    formatDate(
                                                        tag.lastUsedOn,
                                                        intlLocale,
                                                        {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric',
                                                        },
                                                    ),
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                    </div>
                                </div>
                                <span className="hidden text-right text-sm tabular-nums lg:block">
                                    {tag.entryCount}
                                </span>
                                <span className="hidden text-right text-sm tabular-nums lg:block">
                                    {formatHours(
                                        tag.reportedSeconds,
                                        intlLocale,
                                    )}
                                </span>
                                <span className="hidden text-right text-sm text-muted tabular-nums lg:block">
                                    {tag.lastUsedOn
                                        ? formatDate(
                                              tag.lastUsedOn,
                                              intlLocale,
                                              {
                                                  day: 'numeric',
                                                  month: 'short',
                                                  year: 'numeric',
                                              },
                                          )
                                        : '–'}
                                </span>
                                <div className="flex justify-end">
                                    <Dropdown>
                                        <Button
                                            isIconOnly
                                            variant="ghost"
                                            size="sm"
                                            aria-label={t('Actions for :name', {
                                                name: tag.name,
                                            })}
                                        >
                                            <EllipsisVertical className="size-4" />
                                        </Button>
                                        <Dropdown.Popover
                                            placement="bottom end"
                                            className="min-w-40 rounded-3xl"
                                        >
                                            <Dropdown.Menu>
                                                <Dropdown.Item
                                                    id="rename"
                                                    textValue={t('Rename')}
                                                    onAction={() =>
                                                        setRenaming(tag)
                                                    }
                                                >
                                                    <Pencil className="size-4 shrink-0" />
                                                    <Label>{t('Rename')}</Label>
                                                </Dropdown.Item>
                                                <Dropdown.Item
                                                    id="delete"
                                                    textValue={t('Delete')}
                                                    onAction={() =>
                                                        setDeleting(tag)
                                                    }
                                                    variant="danger"
                                                >
                                                    <Trash2 className="size-4 shrink-0 text-danger" />
                                                    <Label>{t('Delete')}</Label>
                                                </Dropdown.Item>
                                            </Dropdown.Menu>
                                        </Dropdown.Popover>
                                    </Dropdown>
                                </div>
                            </li>
                        ))}
                        {visible.length === 0 && (
                            <li className="grid justify-items-center gap-2 p-10 text-center">
                                <Tags className="size-6 text-muted" />
                                <p className="text-sm text-muted">
                                    {query
                                        ? t('No tags match your search.')
                                        : t('No tags yet.')}
                                </p>
                            </li>
                        )}
                    </ul>
                </div>
            </div>

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
                        {...update.form({ tag: renaming.id })}
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

                    router.delete(destroy.url({ tag: deleting.id }), {
                        preserveScroll: true,
                        onStart: () => setDeletePending(true),
                        onFinish: () => setDeletePending(false),
                        onSuccess: () => setDeleting(null),
                    });
                }}
            >
                {deleting &&
                    tc(
                        'The tag ":name" is removed from :count entry. The entry is kept.|The tag ":name" is removed from :count entries. The entries are kept.',
                        deleting.entryCount,
                        { name: deleting.name, count: deleting.entryCount },
                    )}
            </ConfirmDialog>
        </>
    );
}
