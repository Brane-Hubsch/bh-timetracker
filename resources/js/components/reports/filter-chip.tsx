import { Button, Label, ListBox, Popover, SearchField } from '@heroui/react';
import type { Key, Selection } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type FilterOption = {
    value: string;
    label: string;
    /** Avatar, logo or colour dot shown before the label in the list. */
    leading?: ReactNode;
    /** Secondary text after the label, e.g. a project's client. */
    detail?: string;
    isMuted?: boolean;
};

type Props = {
    /** The filter's name, shown while it isn't narrowing anything. */
    label: string;
    options: FilterOption[];
    value: string[];
    onChange: (value: string[]) => void;
    selectionMode?: 'multiple' | 'single';
    /** Whether the filter narrows the report (defaults to having a value). */
    isActive?: boolean;
    /** Text while active (defaults to the chosen labels). */
    activeLabel?: string;
    /** Shown before the text: a sample of the options while idle, the chosen ones while active. */
    renderPreview?: (options: FilterOption[]) => ReactNode;
    icon?: ReactNode;
    'data-test'?: string;
};

/** "Alex Lind, Sam Ek", or "Alex Lind +2" when more are chosen. */
function summarize(chosen: FilterOption[]): string {
    if (chosen.length <= 2) {
        return chosen.map((option) => option.label).join(', ');
    }

    return `${chosen[0].label} +${chosen.length - 1}`;
}

/**
 * A pill-shaped filter button for the report toolbar. While idle it shows the filter's name with a
 * small sample (avatars, logos or colours); once something is chosen it shows the choice in the
 * accent colour. It opens a searchable list with single or multiple selection.
 */
export function FilterChip({
    label,
    options,
    value,
    onChange,
    selectionMode = 'multiple',
    isActive,
    activeLabel,
    renderPreview,
    icon,
    'data-test': dataTest,
}: Props) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const chosen = options.filter((option) => value.includes(option.value));
    const active = isActive ?? chosen.length > 0;
    const isSearchable = options.length > 7;
    const query = search.trim().toLocaleLowerCase();
    const visible = query
        ? options.filter((option) =>
              `${option.label} ${option.detail ?? ''}`
                  .toLocaleLowerCase()
                  .includes(query),
          )
        : options;

    const select = (keys: Selection) => {
        const next =
            keys === 'all'
                ? options.map((option) => option.value)
                : [...keys].map((key: Key) => String(key));

        onChange(next);

        if (selectionMode === 'single') {
            setIsOpen(false);
        }
    };

    return (
        <Popover
            isOpen={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open);

                if (!open) {
                    setSearch('');
                }
            }}
        >
            <Button
                variant="outline"
                className={cn(
                    'h-9 shrink-0 gap-2 rounded-full ps-3 pe-2.5 font-medium transition-colors',
                    active
                        ? 'border-transparent bg-accent-soft text-accent-soft-foreground hover:bg-accent-soft-hover'
                        : 'bg-transparent text-foreground',
                )}
                data-active={active || undefined}
                data-test={dataTest}
            >
                {renderPreview?.(active ? chosen : options.slice(0, 3))}
                {icon}
                <span className="max-w-52 truncate">
                    {active ? (activeLabel ?? summarize(chosen)) : label}
                </span>
                <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
            </Button>
            <Popover.Content
                placement="bottom start"
                className="w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-0"
            >
                <Popover.Dialog
                    aria-label={label}
                    className="grid grid-cols-1 gap-1 p-2"
                >
                    {isSearchable && (
                        <SearchField
                            aria-label={t('Search')}
                            value={search}
                            onChange={setSearch}
                            autoFocus
                            className="w-full"
                        >
                            <SearchField.Group className="w-full min-w-0">
                                <SearchField.SearchIcon />
                                <SearchField.Input placeholder={t('Search')} />
                                <SearchField.ClearButton />
                            </SearchField.Group>
                        </SearchField>
                    )}
                    <ListBox
                        aria-label={label}
                        selectionMode={selectionMode}
                        selectedKeys={new Set(value)}
                        // Escape closes the list; it must not silently clear the filter.
                        escapeKeyBehavior="none"
                        onSelectionChange={select}
                        className="max-h-72 overflow-y-auto"
                        renderEmptyState={() => (
                            <p className="px-3 py-2 text-sm text-muted">
                                {t('No matches')}
                            </p>
                        )}
                    >
                        {visible.map((option) => (
                            <ListBox.Item
                                key={option.value}
                                id={option.value}
                                textValue={option.label}
                                className="gap-2.5"
                            >
                                {option.leading}
                                <span className="min-w-0 flex-1">
                                    <Label
                                        className={cn(
                                            'block truncate',
                                            option.isMuted && 'text-muted',
                                        )}
                                    >
                                        {option.label}
                                    </Label>
                                    {option.detail && (
                                        <span className="block truncate text-xs text-muted">
                                            {option.detail}
                                        </span>
                                    )}
                                </span>
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                    {selectionMode === 'multiple' && (
                        <div className="flex items-center justify-between border-t border-separator ps-2 pt-1">
                            <span className="text-xs text-muted tabular-nums">
                                {chosen.length > 0 &&
                                    t(':count selected', {
                                        count: chosen.length,
                                    })}
                            </span>
                            <Button
                                size="sm"
                                variant="ghost"
                                isDisabled={chosen.length === 0}
                                onPress={() => onChange([])}
                            >
                                {t('Clear')}
                            </Button>
                        </div>
                    )}
                </Popover.Dialog>
            </Popover.Content>
        </Popover>
    );
}
