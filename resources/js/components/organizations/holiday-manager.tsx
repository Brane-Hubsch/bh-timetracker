import { Button } from '@heroui/react';
import { Form, router } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { SelectField } from '@/components/form/select-field';
import { TextInputField } from '@/components/form/text-input-field';
import Heading from '@/components/heading';
import { useTranslation } from '@/lib/i18n';
import { formatDate } from '@/lib/time';
import { destroy, store, swedish } from '@/routes/organizations/holidays';

export type OrganizationHoliday = {
    id: number;
    /** Local date, YYYY-MM-DD. */
    date: string;
    name: string;
};

type Props = {
    organizationSlug: string;
    holidays: OrganizationHoliday[];
    /** Years the Swedish holidays can be filled in for. */
    years: number[];
};

/**
 * The organization's holidays for owners and admins: days that aren't working days (e.g. for the
 * hours needed per working day on project pages). Add the Swedish ones for a year, or days of
 * your own.
 */
export function HolidayManager({ organizationSlug, holidays, years }: Props) {
    const { t, tc, intlLocale } = useTranslation();
    const [year, setYear] = useState(String(years[1] ?? years[0]));
    const [isFilling, setFilling] = useState(false);
    const byYear = Object.entries(
        Object.groupBy(holidays, (holiday) => holiday.date.slice(0, 4)),
    );

    return (
        <section
            id="holidays"
            className="grid scroll-mt-6 gap-4"
            data-test="holiday-manager"
        >
            <Heading
                variant="small"
                title={t('Holidays')}
                description={t(
                    "Days that don't count as working days, e.g. when the project page works out the hours needed per working day. Saturdays and Sundays never count.",
                )}
            />

            <div className="grid gap-3">
                <Form
                    {...store.form({ organization: organizationSlug })}
                    options={{ preserveScroll: true }}
                    resetOnSuccess
                    className="flex flex-wrap items-center gap-2"
                >
                    {({ errors, processing }) => (
                        <>
                            <TextInputField
                                name="date"
                                type="date"
                                label={
                                    <span className="sr-only">{t('Date')}</span>
                                }
                                error={errors.date}
                                className="w-40"
                                data-test="holiday-date"
                            />
                            <TextInputField
                                name="name"
                                label={
                                    <span className="sr-only">{t('Name')}</span>
                                }
                                placeholder={t('Name, e.g. Kick-off')}
                                error={errors.name}
                                className="w-full min-w-0 sm:w-60"
                                data-test="holiday-name"
                            />
                            <Button
                                type="submit"
                                isPending={processing}
                                data-test="add-holiday-button"
                            >
                                {t('Add')}
                            </Button>
                        </>
                    )}
                </Form>

                <div className="flex flex-wrap items-center gap-2">
                    <SelectField
                        name="year"
                        label={<span className="sr-only">{t('Year')}</span>}
                        value={year}
                        onChange={setYear}
                        options={years.map((option) => ({
                            value: String(option),
                            label: String(option),
                        }))}
                        className="w-28"
                    />
                    <Button
                        variant="secondary"
                        isPending={isFilling}
                        onPress={() =>
                            router.post(
                                swedish.url({ organization: organizationSlug }),
                                { year: Number(year) },
                                {
                                    preserveScroll: true,
                                    onStart: () => setFilling(true),
                                    onFinish: () => setFilling(false),
                                },
                            )
                        }
                        data-test="add-swedish-holidays"
                    >
                        <Plus className="size-4" />
                        {t('Swedish holidays')}
                    </Button>
                </div>
            </div>

            {byYear.map(([holidayYear, items]) => (
                <div key={holidayYear} className="grid gap-2">
                    <p className="flex items-baseline gap-2 text-sm">
                        <span className="font-semibold">{holidayYear}</span>
                        <span className="text-muted">
                            {tc(':count day|:count days', items?.length ?? 0, {
                                count: items?.length ?? 0,
                            })}
                        </span>
                    </p>
                    <ul className="divide-y divide-separator rounded-2xl bg-surface shadow-surface">
                        {items?.map((holiday) => (
                            <li
                                key={holiday.id}
                                className="flex items-center gap-3 py-1.5 ps-4 pe-2"
                                data-test="holiday-row"
                            >
                                <span className="w-16 shrink-0 font-medium tabular-nums">
                                    {formatDate(holiday.date, intlLocale, {
                                        day: 'numeric',
                                        month: 'short',
                                    })}
                                </span>
                                <span className="w-10 shrink-0 text-sm text-muted">
                                    {formatDate(holiday.date, intlLocale, {
                                        weekday: 'short',
                                    })}
                                </span>
                                <span className="min-w-0 flex-1 truncate">
                                    {holiday.name}
                                </span>
                                <Button
                                    isIconOnly
                                    variant="ghost"
                                    size="sm"
                                    aria-label={t('Delete :name', {
                                        name: holiday.name,
                                    })}
                                    onPress={() =>
                                        router.delete(
                                            destroy.url({
                                                organization: organizationSlug,
                                                holiday: holiday.id,
                                            }),
                                            { preserveScroll: true },
                                        )
                                    }
                                >
                                    <Trash2 className="size-4 text-danger" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
            {holidays.length === 0 && (
                <p className="rounded-2xl bg-surface p-6 text-center text-sm text-muted shadow-surface">
                    {t('No holidays yet.')}
                </p>
            )}
        </section>
    );
}
