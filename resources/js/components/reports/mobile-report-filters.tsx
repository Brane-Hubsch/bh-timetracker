import { Button, Checkbox, Drawer, Label, SearchField } from '@heroui/react';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { BottomSheetBackdrop } from '@/components/bottom-sheet-backdrop';
import {
    summarizeFilter,
    filterOptionSections,
} from '@/components/reports/filter-chip';
import {
    activeReportFilters,
    clearReportFilters,
    reportBillingLabels,
    useReportFilterOptions,
} from '@/components/reports/report-filter-options';
import type { ReportSelection } from '@/components/reports/report-filter-options';
import { SegmentedControl } from '@/components/segmented-control';
import { formatDecimalHours } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ReportFilterValues, ReportOptions } from '@/types';

type Props = {
    filters: ReportFilterValues;
    options: ReportOptions;
    seconds: number;
    apply: (changes: Partial<ReportFilterValues>) => void;
};

type Filter = ReturnType<typeof useReportFilterOptions>[number];

export function MobileReportFilterSummary({
    filters,
    options,
}: Pick<Props, 'filters' | 'options'>) {
    const { t } = useTranslation();
    const selections = useReportFilterOptions(options);
    const labels = selections.flatMap(({ key, options, countLabel }) => {
        const selected = filters[key];
        if (!selected.length) return [];
        const name = options.find(({ value }) => value === selected[0])?.label;
        return [
            selected.length === 1 && name
                ? name
                : t(countLabel, { count: selected.length }),
        ];
    });
    if (filters.billable !== null) {
        labels.push(
            t(
                filters.billable === '1'
                    ? reportBillingLabels['1']
                    : reportBillingLabels['0'],
            ),
        );
    }

    return (
        labels.length > 0 && (
            <p className="truncate text-xs/3 text-muted">
                {labels.join(' · ')}
            </p>
        )
    );
}

function FilterChoices({
    filter,
    value,
    onChange,
}: {
    filter: Filter;
    value: string[];
    onChange: (value: string[]) => void;
}) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const sections = filterOptionSections(
        filter.options,
        search,
        filter.statusSections,
    );

    return (
        <div className="grid gap-3">
            {filter.options.length > 7 && (
                <SearchField
                    aria-label={filter.searchLabel}
                    value={search}
                    onChange={setSearch}
                >
                    <SearchField.Group className="h-10 border-transparent bg-background shadow-[inset_0_1px_3px_#0000000d]">
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder={filter.searchLabel} />
                        <SearchField.ClearButton />
                    </SearchField.Group>
                </SearchField>
            )}

            {sections.length === 0 && (
                <p className="py-2 text-sm text-muted">{t('No matches')}</p>
            )}
            {sections.map((section) => (
                <div key={section.label ?? filter.key}>
                    {section.label && (
                        <p className="pt-2 text-[13px] font-medium text-muted">
                            {section.label}
                        </p>
                    )}
                    {section.options.map((option) => {
                        const selected = value.includes(option.value);
                        return (
                            <Checkbox
                                key={option.value}
                                isSelected={selected}
                                onChange={(checked) =>
                                    onChange(
                                        checked
                                            ? [...value, option.value]
                                            : value.filter(
                                                  (id) => id !== option.value,
                                              ),
                                    )
                                }
                                className="w-full"
                            >
                                <Checkbox.Content className="flex min-h-11 w-full items-center gap-2.5">
                                    <Checkbox.Control className="size-5 rounded-md">
                                        <Checkbox.Indicator />
                                    </Checkbox.Control>
                                    {option.leading}
                                    <Label
                                        className={cn(
                                            'min-w-0 flex-1 truncate text-[15px]',
                                            selected && 'font-medium',
                                            option.isMuted && 'text-muted',
                                        )}
                                    >
                                        {option.label}
                                    </Label>
                                    {option.detail && (
                                        <span className="max-w-[36%] truncate text-[13px] text-muted">
                                            {option.detail}
                                        </span>
                                    )}
                                </Checkbox.Content>
                            </Checkbox>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

export function MobileReportFilters({
    filters,
    options,
    seconds,
    apply,
}: Props) {
    const { t, tc, intlLocale } = useTranslation();
    const [open, setOpen] = useState(false);
    const [selection, setSelection] = useState<ReportSelection | null>(null);
    const selections = useReportFilterOptions(options);
    const current = selections.find(({ key }) => key === selection);
    const activeCount = activeReportFilters(filters);
    const close = (next: boolean) => {
        setOpen(next);
        if (!next) setSelection(null);
    };
    const openSection = (key: ReportSelection | null) => {
        setSelection(key);
    };
    const billing =
        filters.billable === '0' || filters.billable === '1'
            ? filters.billable
            : 'all';

    return (
        <Drawer isOpen={open} onOpenChange={close}>
            <Button
                isIconOnly
                variant="outline"
                aria-label={
                    activeCount
                        ? tc('Filters, :count selected', activeCount)
                        : t('Filters')
                }
                className={cn(
                    'relative grid size-[34px] min-w-0 shrink-0 place-items-center overflow-visible rounded-full p-0 before:absolute before:-inset-x-[5px] before:-inset-y-1.5 before:content-[""]',
                    activeCount
                        ? 'border-accent/35 bg-accent/10 text-accent'
                        : 'border-border bg-surface text-foreground',
                )}
                data-test="mobile-report-filters"
            >
                <SlidersHorizontal aria-hidden="true" className="size-[18px]" />
                {activeCount > 0 && (
                    <span
                        aria-hidden="true"
                        className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-accent"
                    />
                )}
            </Button>

            <BottomSheetBackdrop variant="opaque">
                <Drawer.Content placement="bottom">
                    <Drawer.Dialog className="max-h-[92svh] gap-0 rounded-t-3xl bg-surface p-0">
                        <Drawer.Handle className="pt-2 pb-0" />
                        <Drawer.Header className="min-h-12 flex-row items-center gap-2 px-4 pt-2 pb-1">
                            {current && (
                                <Button
                                    isIconOnly
                                    variant="secondary"
                                    size="sm"
                                    aria-label={t('Back to filters')}
                                    className="size-7 min-w-0 rounded-full p-0"
                                    onPress={() => openSection(null)}
                                >
                                    <ChevronLeft className="size-4" />
                                </Button>
                            )}
                            <Drawer.Heading className="flex-1 text-[17px]/[21px] font-semibold">
                                {current?.label ?? t('Filters')}
                            </Drawer.Heading>
                            {(current
                                ? filters[current.key].length > 0
                                : activeCount > 0) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="px-0 text-sm text-accent"
                                    onPress={() =>
                                        apply(
                                            current
                                                ? { [current.key]: [] }
                                                : clearReportFilters,
                                        )
                                    }
                                >
                                    {t('Clear')}
                                </Button>
                            )}
                        </Drawer.Header>

                        <Drawer.Body
                            key={current?.key ?? 'overview'}
                            className="m-0! min-h-0 px-4 pt-2 pb-0"
                        >
                            {current ? (
                                <FilterChoices
                                    filter={current}
                                    value={filters[current.key]}
                                    onChange={(value) =>
                                        apply({ [current.key]: value })
                                    }
                                />
                            ) : (
                                <>
                                    <div className="divide-y divide-separator">
                                        {selections.map((filter) => {
                                            const selected =
                                                filter.options.filter(
                                                    ({ value }) =>
                                                        filters[
                                                            filter.key
                                                        ].includes(value),
                                                );
                                            // Keep the compact project count shown in the mobile design.
                                            const label =
                                                filter.key === 'projects' &&
                                                selected.length >= 2
                                                    ? t(filter.countLabel, {
                                                          count: selected.length,
                                                      })
                                                    : summarizeFilter(selected);

                                            return (
                                                <Button
                                                    key={filter.key}
                                                    variant="ghost"
                                                    className="h-[50px] w-full justify-between gap-2 rounded-none px-0 text-[15px] font-normal"
                                                    onPress={() =>
                                                        openSection(filter.key)
                                                    }
                                                >
                                                    <span className="shrink-0">
                                                        {filter.label}
                                                    </span>
                                                    <span className="flex min-w-0 items-center gap-2">
                                                        {selected.length > 0 &&
                                                            filter.renderPreview?.(
                                                                selected,
                                                            )}
                                                        <span
                                                            className={cn(
                                                                'truncate',
                                                                selected.length
                                                                    ? 'font-medium'
                                                                    : 'text-muted',
                                                            )}
                                                        >
                                                            {label || t('All')}
                                                        </span>
                                                        <ChevronRight
                                                            aria-hidden="true"
                                                            className="size-4 shrink-0 text-muted"
                                                        />
                                                    </span>
                                                </Button>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-4 grid gap-1.5">
                                        <span className="text-[13px] text-muted">
                                            {t('Billing')}
                                        </span>
                                        <SegmentedControl
                                            aria-label={t('Billing')}
                                            fullWidth
                                            value={billing}
                                            onChange={(value) =>
                                                apply({
                                                    billable:
                                                        value === 'all'
                                                            ? null
                                                            : value,
                                                })
                                            }
                                            options={[
                                                {
                                                    id: 'all',
                                                    label: t(
                                                        reportBillingLabels.all,
                                                    ),
                                                },
                                                {
                                                    id: '1',
                                                    label: t(
                                                        reportBillingLabels[
                                                            '1'
                                                        ],
                                                    ),
                                                },
                                                {
                                                    id: '0',
                                                    label: t(
                                                        reportBillingLabels[
                                                            '0'
                                                        ],
                                                    ),
                                                },
                                            ]}
                                        />
                                    </div>
                                </>
                            )}
                        </Drawer.Body>

                        <Drawer.Footer className="px-6 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                            <Button
                                className="h-10 w-full rounded-full"
                                onPress={() => close(false)}
                            >
                                {t('Show :hours', {
                                    hours: formatDecimalHours(
                                        seconds,
                                        intlLocale,
                                    ),
                                })}
                            </Button>
                        </Drawer.Footer>
                    </Drawer.Dialog>
                </Drawer.Content>
            </BottomSheetBackdrop>
        </Drawer>
    );
}
