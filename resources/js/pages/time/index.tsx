import { Button, Tabs } from '@heroui/react';
import { Head, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, CopyPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import { SelectField } from '@/components/form/select-field';
import type { SelectOption } from '@/components/form/select-field';
import { CopyWeekDialog } from '@/components/time/copy-week-dialog';
import { TimeCalendar } from '@/components/time/time-calendar';
import { newDraft } from '@/components/time/drafts';
import {
    TimeEntryForm,
    draftFromEntry,
} from '@/components/time/time-entry-form';
import { TimeEntryList } from '@/components/time/time-entry-list';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useTranslation } from '@/lib/i18n';
import {
    addDays,
    formatDate,
    formatDuration,
    isoWeek,
    minutesToTime,
    secondsBetween,
    timeOf,
    timeToMinutes,
    weekDates,
} from '@/lib/time';
import { index, update } from '@/routes/time';
import type { ProjectOption, TimeEntry, TimeEntryDraft } from '@/types';

type View = 'list' | 'week' | 'day';

type Props = {
    date: string;
    today: string;
    weekStart: string;
    weekStartsOn: number;
    timezone: string;
    entries: TimeEntry[];
    projects: ProjectOption[];
    member: { id: number; name: string };
    members: SelectOption[];
    previousWeek?: TimeEntry[];
};

export default function TimeIndex({
    date,
    today,
    weekStart,
    weekStartsOn,
    entries,
    projects,
    member,
    members,
    previousWeek,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const isDesktop = useIsDesktop();
    const params = new URLSearchParams(
        typeof window === 'undefined' ? '' : window.location.search,
    );
    const requestedView = params.get('view') as View | null;
    const view: View = requestedView ?? (isDesktop ? 'week' : 'list');
    const [draft, setDraft] = useState<TimeEntryDraft | null>(null);
    const [isCopyOpen, setCopyOpen] = useState(false);

    const dates = weekDates(weekStart);
    const weekTotal = entries.reduce(
        (sum, entry) => sum + entry.durationSeconds,
        0,
    );

    const visit = (changes: { date?: string; view?: View; user?: number }) =>
        router.get(
            index.url(),
            {
                date: changes.date ?? date,
                view: changes.view ?? requestedView ?? undefined,
                user:
                    (changes.user ?? member.id) === undefined
                        ? undefined
                        : (changes.user ?? member.id),
            },
            { preserveScroll: true, preserveState: true, replace: true },
        );

    const step = view === 'day' ? 1 : 7;

    const move = (
        entry: TimeEntry,
        start: string,
        end: string,
        revert: () => void,
    ) =>
        router.patch(
            update.url({ timeEntry: entry.id }),
            {
                user_id: entry.userId,
                project_id: entry.project.id,
                description: entry.description,
                is_billable: entry.isBillable,
                date: start.slice(0, 10),
                start: timeOf(start),
                end: timeOf(end),
            },
            {
                preserveScroll: true,
                preserveState: true,
                onError: () => revert(),
            },
        );

    const title =
        view === 'day'
            ? formatDate(date, intlLocale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
              })
            : `${t('Week :number', { number: isoWeek(weekStart) })} · ${formatDate(dates[0], intlLocale, { day: 'numeric', month: 'short' })}–${formatDate(dates[6], intlLocale, { day: 'numeric', month: 'short' })}`;

    return (
        <>
            <Head title={t('Calendar')} />

            <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                        <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            aria-label={t('Previous')}
                            onPress={() =>
                                visit({ date: addDays(date, -step) })
                            }
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onPress={() => visit({ date: today })}
                        >
                            {t('Today')}
                        </Button>
                        <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            aria-label={t('Next')}
                            onPress={() => visit({ date: addDays(date, step) })}
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                    <h1
                        className={
                            view === 'day'
                                ? 'text-lg font-semibold first-letter:uppercase'
                                : 'text-lg font-semibold'
                        }
                    >
                        {title}
                    </h1>
                    <span
                        className="text-sm text-muted tabular-nums"
                        data-test="week-total"
                    >
                        {t('Week total :hours', {
                            hours: formatDuration(weekTotal),
                        })}
                    </span>

                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        {members.length > 1 && (
                            <SelectField
                                name="user"
                                label={
                                    <span className="sr-only">
                                        {t('Member')}
                                    </span>
                                }
                                value={String(member.id)}
                                onChange={(value) =>
                                    visit({ user: Number(value) })
                                }
                                options={members}
                                className="w-44"
                                data-test="member-select"
                            />
                        )}
                        <Tabs
                            selectedKey={view}
                            onSelectionChange={(key) =>
                                visit({ view: key as View })
                            }
                        >
                            <Tabs.ListContainer>
                                <Tabs.List aria-label={t('View')}>
                                    <Tabs.Tab id="list">
                                        {t('List')}
                                        <Tabs.Indicator />
                                    </Tabs.Tab>
                                    <Tabs.Tab id="week">
                                        {t('Week')}
                                        <Tabs.Indicator />
                                    </Tabs.Tab>
                                    <Tabs.Tab id="day">
                                        {t('Day')}
                                        <Tabs.Indicator />
                                    </Tabs.Tab>
                                </Tabs.List>
                            </Tabs.ListContainer>
                        </Tabs>
                        <Button
                            variant="tertiary"
                            onPress={() => setCopyOpen(true)}
                            data-test="copy-week-button"
                        >
                            <CopyPlus className="size-4" />
                            <span className="hidden lg:inline">
                                {t('Copy previous week')}
                            </span>
                        </Button>
                        <Button
                            className="hidden md:inline-flex"
                            onPress={() =>
                                setDraft(
                                    newDraft(
                                        date === today || dates.includes(today)
                                            ? today
                                            : date,
                                        entries,
                                        member.id,
                                    ),
                                )
                            }
                            data-test="new-time-button"
                        >
                            <Plus className="size-4" />
                            {t('Report time')}
                        </Button>
                    </div>
                </div>

                {view === 'list' ? (
                    <TimeEntryList
                        dates={dates}
                        today={today}
                        entries={entries}
                        onEdit={(entry) => setDraft(draftFromEntry(entry))}
                        onAdd={(day) =>
                            setDraft(newDraft(day, entries, member.id))
                        }
                    />
                ) : (
                    <TimeCalendar
                        view={view}
                        date={date}
                        weekStartsOn={weekStartsOn}
                        now={`${today}T${new Date().toTimeString().slice(0, 5)}`}
                        entries={entries}
                        onSelect={(start, end) =>
                            setDraft({
                                ...newDraft(
                                    start.slice(0, 10),
                                    entries,
                                    member.id,
                                ),
                                start: timeOf(start),
                                end: timeOf(end),
                            })
                        }
                        onEdit={(entry) => setDraft(draftFromEntry(entry))}
                        onChange={move}
                    />
                )}
            </div>

            {/* Big "+" on mobile. */}
            <Button
                isIconOnly
                className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg md:hidden"
                aria-label={t('Report time')}
                onPress={() =>
                    setDraft(
                        newDraft(
                            dates.includes(today) ? today : date,
                            entries,
                            member.id,
                        ),
                    )
                }
                data-test="new-time-fab"
            >
                <Plus className="size-6" />
            </Button>

            <TimeEntryForm
                draft={draft}
                onClose={() => setDraft(null)}
                projects={projects}
                entries={entries}
                onDuplicate={(values) => {
                    const base = newDraft(today, entries, member.id);
                    const seconds = values.end
                        ? secondsBetween(values.start, values.end)
                        : 0;

                    setDraft({
                        ...base,
                        projectId: values.projectId,
                        description: values.description,
                        isBillable: values.isBillable,
                        end: seconds
                            ? minutesToTime(
                                  timeToMinutes(base.start) + seconds / 60,
                              )
                            : '',
                    });
                }}
            />

            <CopyWeekDialog
                isOpen={isCopyOpen}
                onOpenChange={setCopyOpen}
                entries={previousWeek}
            />
        </>
    );
}
