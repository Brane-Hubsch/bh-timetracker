import { Button } from '@heroui/react';
import { Head, router, setLayoutProps, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, CopyPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import { SelectField } from '@/components/form/select-field';
import { SegmentedControl } from '@/components/segmented-control';
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
import { useOpenFromQuery } from '@/hooks/use-open-from-query';
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
    /** Recently used project ids per member id (owners and admins). */
    recentProjects: Record<string, string[]>;
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
    recentProjects,
    previousWeek,
}: Props) {
    const { t, intlLocale } = useTranslation();
    const isDesktop = useIsDesktop();
    const { url } = usePage();
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    const requestedView = params.get('view') as View | null;
    const view: View = requestedView ?? (isDesktop ? 'week' : 'list');

    // The calendar uses the full width of wide screens; the list reads better in a narrower column.
    setLayoutProps({ width: view === 'list' ? 'default' : 'wide' });
    const [draft, setDraft] = useState<TimeEntryDraft | null>(null);
    const [isCopyOpen, setCopyOpen] = useState(false);

    // Opened from the command palette ("Report time", "Report time on …", "Copy previous week").
    useOpenFromQuery(
        'new',
        (params) => {
            const project = projects.find(
                (option) => option.value === params.get('project'),
            );
            const base = newDraft(
                dates.includes(today) ? today : date,
                entries,
                member.id,
            );

            setDraft(
                project
                    ? {
                          ...base,
                          projectId: project.value,
                          isBillable: project.isBillable,
                      }
                    : base,
            );
        },
        ['project'],
    );
    useOpenFromQuery('copy', () => setCopyOpen(true));

    const dates = weekDates(weekStart);
    const weekTotal = entries.reduce(
        (sum, entry) => sum + entry.durationSeconds,
        0,
    );
    const dayTotal = entries
        .filter((entry) => entry.date === date)
        .reduce((sum, entry) => sum + entry.durationSeconds, 0);

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

            <div className="grid grid-cols-1 gap-4">
                {/* Two rows on mobile (navigation and title, then filters and actions); one on desktop. */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
                    <div className="flex shrink-0 items-center gap-1">
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
                    <div className="flex min-w-0 flex-1 flex-col md:flex-none md:flex-row md:items-baseline md:gap-2">
                        <h1
                            className={`truncate text-base font-semibold md:text-lg ${view === 'day' ? 'first-letter:uppercase' : ''}`}
                        >
                            {title}
                        </h1>
                        <span
                            className="text-xs text-muted tabular-nums md:text-sm"
                            data-test="week-total"
                        >
                            {view === 'day'
                                ? t('Day total :hours', {
                                      hours: formatDuration(dayTotal),
                                  })
                                : t('Week total :hours', {
                                      hours: formatDuration(weekTotal),
                                  })}
                        </span>
                    </div>

                    <div className="flex w-full items-center gap-2 md:ml-auto md:w-auto md:flex-wrap md:justify-end">
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
                                className="min-w-0 flex-1 md:w-44 md:flex-none"
                                data-test="member-select"
                            />
                        )}
                        <SegmentedControl
                            aria-label={t('View')}
                            value={view}
                            onChange={(next) => visit({ view: next })}
                            className={
                                members.length > 1
                                    ? 'shrink-0'
                                    : 'flex-1 md:flex-none [&>*]:flex-1 md:[&>*]:flex-none'
                            }
                            options={[
                                { id: 'list', label: t('List') },
                                { id: 'week', label: t('Week') },
                                { id: 'day', label: t('Day') },
                            ]}
                            data-test="time-view"
                        />
                        <Button
                            variant="tertiary"
                            className="shrink-0"
                            onPress={() => setCopyOpen(true)}
                            aria-label={t('Copy previous week')}
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

                {/* Fades in when the week, day or view changes (not after saving an entry). */}
                <div
                    key={`${view}-${weekStart}-${view === 'day' ? date : ''}`}
                    className="animate-fade-in"
                >
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
                members={members}
                recentProjects={recentProjects}
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
