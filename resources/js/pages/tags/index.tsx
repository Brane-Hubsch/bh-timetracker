import { Button, Dropdown, Label, SearchField } from '@heroui/react';
import { Form, Head, router, usePage } from '@inertiajs/react';
import {
    EllipsisVertical,
    Merge,
    Pencil,
    Tag as TagIcon,
    Tags,
    Trash2,
} from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { TextInputField } from '@/components/form/text-input-field';
import Heading from '@/components/heading';
import { MobileListFilters } from '@/components/mobile-list-filters';
import { MobileListHeader } from '@/components/mobile-list-header';
import {
    columnOrderHeaderClassName,
    ColumnOrderStatus,
    ReorderableColumnHeader,
    useColumnOrder,
} from '@/components/reorderable-column-header';
import { ResponsiveDialog } from '@/components/responsive-dialog';
import {
    SideDrawer,
    SideDrawerBody,
    SideDrawerFooter,
    sideDrawerFormClass,
} from '@/components/side-drawer';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useOverlayData } from '@/hooks/use-overlay-data';
import { formatHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { normalizeTagName } from '@/lib/tags';
import { formatDate } from '@/lib/time';
import { cn } from '@/lib/utils';
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

const defaultColumnOrder = ['Entries', 'Reported', 'Last used'] as const;
type UsageColumn = (typeof defaultColumnOrder)[number];

const columnWidths: Record<UsageColumn, string> = {
    Entries: '7rem',
    Reported: '8rem',
    'Last used': '8.5rem',
};

const lastUsedDateFormat: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
};

const COLUMNS = 'lg:grid-cols-(--tag-grid-columns) lg:items-center lg:gap-x-6';

const RENAME_FORM = 'rename-tag-form';
const keyboardFooterClass = 'in-data-keyboard-open:pb-2';

/**
 * The organization's tags for owners and admins, with their usage: add, search, rename (renaming to
 * an existing name merges the two) and delete. Members create tags while reporting time.
 */
export default function TagsIndex({ tags }: Props) {
    const { t, tc, intlLocale } = useTranslation();
    const isDesktop = useIsDesktop();
    const { auth, timer } = usePage().props;
    const order = useColumnOrder({
        storageKey: `timereport:tag-list-column-order:${auth.user.id}`,
        defaultOrder: defaultColumnOrder,
    });
    const gridStyle = {
        '--tag-grid-columns': [
            'minmax(0,1fr)',
            ...order.columns.map((column) => columnWidths[column]),
            '2.5rem',
        ].join(' '),
    } as CSSProperties;
    const [isCreateOpen, setCreateOpen] = useState(false);
    const [isSearchOpen, setSearchOpen] = useState(false);
    const [search, setSearch] = useState('');
    const query = search.trim().toLocaleLowerCase();
    const visible = query
        ? tags.filter((tag) => tag.name.toLocaleLowerCase().includes(query))
        : tags;
    const [renaming, setRenaming] = useState<OrganizationTag | null>(null);
    const [renameName, setRenameName] = useState('');
    const [deleting, setDeleting] = useState<OrganizationTag | null>(null);
    const renameTag = useOverlayData(renaming);
    const deleteTag = useOverlayData(deleting);
    const [isDeletePending, setDeletePending] = useState(false);

    const normalizedRenameName = normalizeTagName(renameName);
    const mergeTarget =
        renameTag &&
        tags.find(
            (tag) =>
                tag.id !== renameTag.id &&
                normalizeTagName(tag.name) === normalizedRenameName,
        );
    const openCreate = () => setCreateOpen(true);
    const clearSearch = () => setSearch('');

    const formatLastUsed = (date: string) =>
        formatDate(date, intlLocale, lastUsedDateFormat);

    const usageValue = (column: UsageColumn, tag: OrganizationTag) => {
        switch (column) {
            case 'Entries':
                return tag.entryCount;
            case 'Reported':
                return formatHours(tag.reportedSeconds, intlLocale);
            case 'Last used':
                return tag.lastUsedOn ? formatLastUsed(tag.lastUsedOn) : '–';
        }
    };

    return (
        <>
            <Head title={t('Tags')} />

            <div
                className={cn(
                    'flex flex-col md:grid md:grid-cols-1 md:gap-6',
                    timer
                        ? 'max-md:min-h-[calc(100svh-var(--mobile-tab-bar-height)-var(--mobile-timer-space))]'
                        : 'max-md:min-h-[calc(100svh-var(--mobile-tab-bar-height))]',
                )}
                data-test="tag-manager"
            >
                {isDesktop ? (
                    <>
                        <Heading
                            title={t('Tags')}
                            description={t(
                                'Everyone can add tags when reporting time. Renaming a tag to the name of another merges them.',
                            )}
                        />

                        <div className="flex items-center justify-between gap-3">
                            <SearchField
                                aria-label={t('Search tags')}
                                value={search}
                                onChange={setSearch}
                                className="min-w-0 flex-1 sm:max-w-xs"
                            >
                                <SearchField.Group>
                                    <SearchField.SearchIcon />
                                    <SearchField.Input
                                        className="min-w-0"
                                        placeholder={t('Search tags')}
                                    />
                                    <SearchField.ClearButton />
                                </SearchField.Group>
                            </SearchField>

                            <Button
                                className="h-9 shrink-0"
                                onPress={openCreate}
                                data-test="add-tag-button"
                            >
                                {t('Add')}
                            </Button>
                        </div>
                    </>
                ) : (
                    <MobileListHeader
                        title={t('Tags')}
                        filterLabels={query ? [`“${search.trim()}”`] : []}
                        filtersOpen={isSearchOpen}
                        onOpenFilters={() => setSearchOpen(true)}
                        filterTestId="mobile-tag-search"
                        searchLabel={t('Search tags')}
                        createAction={{
                            label: t('New tag'),
                            onPress: openCreate,
                            testId: 'new-tag-button',
                        }}
                    />
                )}

                <ColumnOrderStatus announcement={order.announcement} />
                <div
                    className="max-md:flex max-md:flex-1 max-md:flex-col md:overflow-hidden md:rounded-2xl md:bg-surface md:shadow-surface"
                    style={gridStyle}
                >
                    {visible.length > 0 && (
                        <div
                            className={`hidden border-b border-separator py-2.5 ps-5 pe-3 text-sm font-medium text-muted lg:grid ${COLUMNS} ${columnOrderHeaderClassName}`}
                        >
                            <span>{t('Tag')}</span>
                            {order.columns.map((column) => (
                                <ReorderableColumnHeader
                                    key={column}
                                    order={order}
                                    column={column}
                                    label={t(column)}
                                />
                            ))}
                            <span />
                        </div>
                    )}
                    <ul className="max-md:flex max-md:flex-1 max-md:flex-col md:divide-y md:divide-separator">
                        {visible.map((tag) => (
                            <li
                                key={tag.id}
                                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-3 ps-4 pe-2 max-md:relative max-md:not-last:after:pointer-events-none max-md:not-last:after:absolute max-md:not-last:after:inset-s-11 max-md:not-last:after:inset-e-0 max-md:not-last:after:bottom-0 max-md:not-last:after:border-b max-md:not-last:after:border-separator max-md:not-last:after:content-[''] md:py-2.5 lg:py-2 lg:ps-5 lg:pe-3 ${COLUMNS}`}
                                data-test="tag-row"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <TagIcon
                                        aria-hidden="true"
                                        className="size-4 shrink-0 text-muted"
                                    />
                                    <div className="min-w-0 max-md:space-y-0.5">
                                        <p className="truncate font-medium max-md:text-[15px]/5">
                                            {tag.name}
                                        </p>
                                        {/* On mobile the usage sits under the name. */}
                                        <p className="truncate text-xs text-muted max-md:text-[13px]/[18px] lg:hidden">
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
                                                    formatLastUsed(
                                                        tag.lastUsedOn,
                                                    ),
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                    </div>
                                </div>
                                {order.columns.map((column) => (
                                    <span
                                        key={column}
                                        className={`hidden text-sm tabular-nums lg:block ${column === 'Last used' ? 'text-muted' : ''}`}
                                    >
                                        {usageValue(column, tag)}
                                    </span>
                                ))}
                                <div className="flex justify-end">
                                    <Dropdown>
                                        <Button
                                            isIconOnly
                                            variant="ghost"
                                            size="sm"
                                            className="max-md:relative max-md:size-[34px] max-md:min-w-0 max-md:overflow-visible max-md:rounded-full max-md:p-0 max-md:before:absolute max-md:before:-inset-[5px] max-md:before:content-[''] max-md:aria-expanded:bg-default"
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
                                                    onAction={() => {
                                                        setRenameName(tag.name);
                                                        setRenaming(tag);
                                                    }}
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
                            <li className="grid justify-items-center py-10 text-center max-md:flex-1 max-md:place-content-center max-md:px-4 md:gap-2 md:px-10">
                                <span className="grid place-items-center text-muted max-md:mb-4 max-md:size-[52px] max-md:rounded-full max-md:bg-default">
                                    <Tags
                                        aria-hidden="true"
                                        className="size-6"
                                    />
                                </span>
                                <p className="text-[15px] font-medium md:text-sm md:font-normal md:text-muted">
                                    {query
                                        ? t('No tags match your search.')
                                        : t('No tags yet.')}
                                </p>
                                {!isDesktop &&
                                    (query ? (
                                        <Button
                                            variant="ghost"
                                            className="text-accent"
                                            onPress={clearSearch}
                                        >
                                            {t('Clear search')}
                                        </Button>
                                    ) : (
                                        <p className="mt-1.5 max-w-60 text-[13px]/[18px] text-muted">
                                            {t(
                                                'Create the first tag with + or while reporting time.',
                                            )}
                                        </p>
                                    ))}
                            </li>
                        )}
                    </ul>
                </div>
            </div>

            {!isDesktop && (
                <MobileListFilters
                    title={t('Search')}
                    isOpen={isSearchOpen}
                    onOpenChange={setSearchOpen}
                    hasFilters={Boolean(query)}
                    onClear={clearSearch}
                    searchLabel={t('Search tags')}
                    search={search}
                    onSearchChange={setSearch}
                    autoFocusSearch
                    onSearchSubmit={() => setSearchOpen(false)}
                    doneLabel={tc(
                        'Show :count tag|Show :count tags',
                        visible.length,
                    )}
                />
            )}

            <SideDrawer
                isOpen={isCreateOpen}
                onOpenChange={setCreateOpen}
                title={t('New tag')}
                mobileClassName={keyboardFooterClass}
            >
                <Form
                    {...store.form()}
                    options={{ preserveScroll: true }}
                    onSuccess={() => setCreateOpen(false)}
                    className={sideDrawerFormClass}
                >
                    {({ errors, processing }) => (
                        <>
                            <SideDrawerBody>
                                <TextInputField
                                    name="name"
                                    label={t('Name')}
                                    error={errors.name}
                                    isRequired
                                    autoFocus
                                    data-test="new-tag-name"
                                />
                            </SideDrawerBody>
                            <SideDrawerFooter>
                                <Button
                                    type="button"
                                    slot="close"
                                    variant="tertiary"
                                    className="max-md:flex-1"
                                >
                                    {t('Cancel')}
                                </Button>
                                <Button
                                    type="submit"
                                    isPending={processing}
                                    className="max-md:flex-1"
                                    data-test="save-tag-button"
                                >
                                    {t('Save')}
                                </Button>
                            </SideDrawerFooter>
                        </>
                    )}
                </Form>
            </SideDrawer>

            <ResponsiveDialog
                isOpen={renaming !== null}
                onOpenChange={(isOpen) => !isOpen && setRenaming(null)}
                title={t('Rename tag')}
                mobileClassName={`${keyboardFooterClass} [&_[data-slot=drawer-footer]]:mt-3 [&_[data-slot=drawer-heading]]:text-[17px]/[21px]`}
                footer={
                    <>
                        <Button
                            slot="close"
                            variant="tertiary"
                            className="max-md:flex-1"
                        >
                            {t('Cancel')}
                        </Button>
                        <Button
                            type="submit"
                            form={RENAME_FORM}
                            className="max-md:flex-1"
                        >
                            {mergeTarget ? t('Merge') : t('Save')}
                        </Button>
                    </>
                }
            >
                {renameTag && (
                    <Form
                        {...update.form({ tag: renameTag.id })}
                        id={RENAME_FORM}
                        options={{ preserveScroll: true }}
                        onSuccess={() => setRenaming(null)}
                    >
                        {({ errors }) => (
                            <>
                                <TextInputField
                                    name="name"
                                    label={t('Name')}
                                    value={renameName}
                                    onChange={setRenameName}
                                    error={errors.name}
                                    description={
                                        mergeTarget
                                            ? undefined
                                            : t(
                                                  'Renaming to the name of another tag merges them.',
                                              )
                                    }
                                    autoFocus
                                    data-test="rename-tag-name"
                                />
                                <div role="status">
                                    {mergeTarget && (
                                        <div className="mt-1.5 flex items-start gap-2 rounded-xl bg-default px-3 py-2.5 text-[13px]/[18px] text-foreground">
                                            <Merge
                                                aria-hidden="true"
                                                className="size-4 shrink-0"
                                            />
                                            <p>
                                                {tc(
                                                    '":target" already exists. ":name" is merged into it: :count entry gets the tag ":target" and ":name" is removed.|":target" already exists. ":name" is merged into it: :count entries get the tag ":target" and ":name" is removed.',
                                                    renameTag.entryCount,
                                                    {
                                                        name: renameTag.name,
                                                        target: mergeTarget.name,
                                                    },
                                                )}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </>
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
                {deleteTag &&
                    tc(
                        'The tag ":name" is removed from :count entry. The entry is kept.|The tag ":name" is removed from :count entries. The entries are kept.',
                        deleteTag.entryCount,
                        { name: deleteTag.name, count: deleteTag.entryCount },
                    )}
            </ConfirmDialog>
        </>
    );
}
