import { Button, SearchField } from '@heroui/react';
import type { ReactNode } from 'react';
import { SegmentedControl } from '@/components/segmented-control';
import {
    SideDrawer,
    SideDrawerBody,
    SideDrawerFooter,
} from '@/components/side-drawer';
import type { SearchStatusFilters } from '@/hooks/use-mobile-list-filters';
import { useTranslation } from '@/lib/i18n';

type Props = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    hasFilters: boolean;
    onClear: () => void;
    searchLabel: string;
    search: string;
    onSearchChange: (search: string) => void;
    autoFocusSearch?: boolean;
    onSearchSubmit?: () => void;
    status?: SearchStatusFilters['status'];
    archivedLabel?: string;
    onStatusChange?: (status: SearchStatusFilters['status']) => void;
    doneLabel: string;
    children?: ReactNode;
};

export const mobileFilterSegmentsClass =
    'w-full p-[3px] [&>button]:h-8 [&>button]:min-w-0 [&>button]:flex-1 [&>button]:px-1 [&>button]:font-normal [&>button]:text-muted [&>button[data-selected=true]]:font-medium [&>button[data-selected=true]]:text-foreground';

export function MobileFilterSearch({
    label,
    value,
    onChange,
    autoFocus,
    onSubmit,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    autoFocus?: boolean;
    onSubmit?: () => void;
}) {
    return (
        <SearchField
            aria-label={label}
            value={value}
            onChange={onChange}
            autoFocus={autoFocus}
            onSubmit={onSubmit}
        >
            <SearchField.Group className="h-10 border-transparent bg-background shadow-[inset_0_1px_3px_#0000000d]">
                <SearchField.SearchIcon />
                <SearchField.Input
                    placeholder={label}
                    enterKeyHint={onSubmit ? 'search' : undefined}
                />
                <SearchField.ClearButton />
            </SearchField.Group>
        </SearchField>
    );
}

export function MobileListFilters({
    isOpen,
    onOpenChange,
    title,
    hasFilters,
    onClear,
    searchLabel,
    search,
    onSearchChange,
    autoFocusSearch,
    onSearchSubmit,
    status,
    archivedLabel,
    onStatusChange,
    doneLabel,
    children,
}: Props) {
    const { t } = useTranslation();

    return (
        <SideDrawer
            title={title ?? t('Filters')}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            mobileClassName={
                autoFocusSearch ? 'in-data-keyboard-open:pb-2' : undefined
            }
            headerActions={
                hasFilters && (
                    <Button
                        variant="ghost"
                        className="h-8 px-0 text-accent"
                        onPress={onClear}
                    >
                        {t('Clear')}
                    </Button>
                )
            }
        >
            <SideDrawerBody>
                <div className="grid gap-4">
                    <MobileFilterSearch
                        label={searchLabel}
                        value={search}
                        onChange={onSearchChange}
                        autoFocus={autoFocusSearch}
                        onSubmit={onSearchSubmit}
                    />
                    {status && onStatusChange && (
                        <div className="grid gap-1.5">
                            <span className="text-[13px] text-muted">
                                {t('Status')}
                            </span>
                            <SegmentedControl
                                aria-label={t('Status')}
                                className={mobileFilterSegmentsClass}
                                value={status}
                                onChange={onStatusChange}
                                options={[
                                    {
                                        id: 'active',
                                        label: t('Active (plural)'),
                                    },
                                    {
                                        id: 'archived',
                                        label:
                                            archivedLabel ??
                                            t('Archived (plural)'),
                                    },
                                ]}
                            />
                        </div>
                    )}
                    {children}
                </div>
            </SideDrawerBody>
            <SideDrawerFooter>
                <Button slot="close" className="w-full">
                    {doneLabel}
                </Button>
            </SideDrawerFooter>
        </SideDrawer>
    );
}
