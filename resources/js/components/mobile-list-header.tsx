import { Button } from '@heroui/react';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { MobilePageHeader } from '@/components/app-shell/mobile-page-header';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
    title: string;
    filterLabels: string[];
    filterCount?: number;
    filtersOpen: boolean;
    onOpenFilters: () => void;
    filterTestId: string;
    searchLabel?: string;
    createAction?: { label: string; onPress: () => void; testId: string };
};

const buttonClass =
    'relative grid size-[34px] min-w-0 shrink-0 place-items-center overflow-visible rounded-full p-0 before:absolute before:-inset-y-1.5 before:-inset-x-[5px] before:content-[""]';

export function MobileListHeader({
    title,
    filterLabels,
    filterCount = filterLabels.length,
    filtersOpen,
    onOpenFilters,
    filterTestId,
    searchLabel,
    createAction,
}: Props) {
    const { t, tc } = useTranslation();
    const FilterIcon = searchLabel ? Search : SlidersHorizontal;
    const filterLabel = searchLabel
        ? filterCount
            ? t(':search, :count selected', {
                  search: searchLabel,
                  count: filterCount,
              })
            : searchLabel
        : filterCount
          ? tc('Filters, :count selected', filterCount)
          : t('Filters');

    return (
        <MobilePageHeader className="flex items-center justify-between">
            <div className="min-w-0">
                <h1 className="text-[17px]/[21px] font-semibold">{title}</h1>
                {filterLabels.length > 0 && (
                    <p className="truncate text-xs text-muted">
                        {filterLabels.join(' · ')}
                    </p>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <Button
                    isIconOnly
                    variant="outline"
                    aria-label={filterLabel}
                    aria-haspopup="dialog"
                    aria-expanded={filtersOpen}
                    className={cn(
                        buttonClass,
                        filterCount
                            ? 'border-accent/35 bg-accent/10 text-accent'
                            : 'border-border bg-surface text-foreground',
                    )}
                    onPress={onOpenFilters}
                    data-test={filterTestId}
                >
                    <FilterIcon aria-hidden="true" className="size-[18px]" />
                    {filterCount > 0 && (
                        <span
                            aria-hidden="true"
                            className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-accent"
                        />
                    )}
                </Button>
                {createAction && (
                    <Button
                        isIconOnly
                        aria-label={createAction.label}
                        aria-haspopup="dialog"
                        className={cn(
                            buttonClass,
                            'bg-accent text-accent-foreground shadow-sm',
                        )}
                        onPress={createAction.onPress}
                        data-test={createAction.testId}
                    >
                        <Plus aria-hidden="true" className="size-[18px]" />
                    </Button>
                )}
            </div>
        </MobilePageHeader>
    );
}
