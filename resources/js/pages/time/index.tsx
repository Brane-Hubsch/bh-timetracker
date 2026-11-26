import { Avatar, Button, Tooltip } from '@heroui/react';
import { Head, router, usePage } from '@inertiajs/react';
import { Copy } from 'lucide-react';
import { useRef, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { SelectField } from '@/components/form/select-field';
import Heading from '@/components/heading';
import {
    AbsenceDialog,
    draftFromAbsence,
} from '@/components/time/absence-dialog';
import { CalendarPicker } from '@/components/time/calendar-picker';
import { CopyPeriodDialog } from '@/components/time/copy-period-dialog';
import { startTimer } from '@/components/time/running-timer';
import { TimeActionsMenu } from '@/components/time/time-actions-menu';
import { TimeCalendar } from '@/components/time/time-calendar';
import {
    newDraft,
    newPlusDraft,
    plusDurationStorageKey,
    savePlusDurationMinutes,
} from '@/components/time/drafts';
import {
    TimeEntryForm,
    draftFromEntry,
} from '@/components/time/time-entry-form';
import { TimeEntryList } from '@/components/time/time-entry-list';
import { useInitials } from '@/hooks/use-initials';
import { useOpenFromQuery } from '@/hooks/use-open-from-query';
import { useShortcut } from '@/lib/shortcuts';
import { useTranslation } from '@/lib/i18n';
import {
    addDays,
    formatDuration,
    minutesToTime,
    secondsBetween,
    timeOf,
    timeToMinutes,
    weekDates,
} from '@/lib/time';
import { cn } from '@/lib/utils';
import { index, list, update } from '@/routes/time';
import type {
    Absence,
    AbsenceDraft,
    AbsenceType,
    AbsenceTypeOption,
    CalendarHoliday,
    ColleagueOff,
    ProjectOption,
    TimeEntry,
    TimeEntryDraft,
    TimeEntryMemberOption,
    TimeReportMode,
} from '@/types';

type View = 'list' | 'week' | 'day';

type Props = {
    view: View;
    date: string;
    today: string;
    weekStart: string;
    weekStartsOn: number;
    timezone: string;
    entries: TimeEntry[];
    absences: Absence[];
    colleaguesOff: ColleagueOff[];
    absenceTypes: AbsenceTypeOption[];
    recentAbsenceTypes: AbsenceType[];
    workdaySeconds: number;
    holidays: string[];
    calendarHolidays: CalendarHoliday[];
    projects: ProjectOption[];
    /** The organization's tag names. */
    tags: string[];
    recentTags: string[];
    member: { id: number; name: string };
    members: TimeEntryMemberOption[];
    /** Recently used project ids per member id (owners and admins). */
    recentProjects: Record<string, string[]>;
    canCopyPreviousPeriod: boolean;
    previousPeriodEntries?: TimeEntry[];
};

export default function TimeIndex({
    view,
    date,
    today,
    weekStart,
    weekStartsOn,
    timezone,
    entries,
    absences,
    colleaguesOff,
    absenceTypes,
    recentAbsenceTypes,
    workdaySeconds,
    holidays,
    calendarHolidays,
    projects,
    tags,
    recentTags,
    member,
    members,
    recentProjects,
    canCopyPreviousPeriod,
    previousPeriodEntries,
}: Props) {
    const { t } = useTranslation();
    const getInitials = useInitials();
    const { auth, currentOrganization, timer } = usePage().props;
    const startOrganization =
        currentOrganization?.timerEnabled &&
        !timer &&
        member.id === auth.user.id
            ? currentOrganization.slug
            : undefined;
    const onStartTimer = startOrganization
        ? () => startTimer(startOrganization)
        : undefined;
    // The viewer's running timer, when it runs in this organization and their own time is shown.
    const timerHere =
        timer &&
        timer.organization.slug === currentOrganization?.slug &&
        member.id === auth.user.id
            ? timer
            : null;
    const timerDraft = (stop: boolean): TimeEntryDraft | null =>
        timer && {
            timer: true,
            stopTimer: stop,
            userId: auth.user.id,
            projectId: timer.project ? String(timer.project.id) : '',
            description: timer.description ?? '',
            tags: timer.tags,
            date: timer.start.slice(0, 10),
            start: timeOf(timer.start),
            // Stopping after a long run asks to check the end, starting from now. Otherwise the
            // end stays empty, which stops the timer when the form is sent.
            end:
                stop && timer.isLong
                    ? Temporal.Now.plainTimeISO(timezone)
                          .toString({ smallestUnit: 'minute' })
                          .slice(0, 5)
                    : '',
            isBillable: timer.isBillable,
        };
    const plusDurationKey = plusDurationStorageKey(
        auth.user.id,
        currentOrganization?.id,
    );
    const isList = view === 'list';
    const pageTitle = t(isList ? 'List' : 'Calendar');

    const [draft, setDraft] = useState<TimeEntryDraft | null>(null);
    const [isCopyOpen, setCopyOpen] = useState(false);
    const [absenceDraft, setAbsenceDraft] = useState<AbsenceDraft | null>(null);
    const newAbsence = (startsOn: string, endsOn = startsOn) =>
        setAbsenceDraft({
            userId: member.id,
            type: 'vacation',
            startsOn,
            endsOn,
            hoursPerDay: '',
            note: '',
        });

    const dates = weekDates(weekStart);
    const reportDate = dates.includes(today) ? today : date;
    const openReport = (mode: TimeReportMode) =>
        setDraft(
            newPlusDraft(
                newDraft(reportDate, entries, member.id),
                mode,
                timezone,
                plusDurationKey,
            ),
        );

    // A report link can choose a mode, and the command palette may preselect a project.
    useOpenFromQuery(
        'new',
        (params) => {
            const mode = params.get('new');
            if (mode === 'time' || mode === 'absence') {
                openReport(mode);
                return;
            }

            const project = projects.find(
                (option) => option.value === params.get('project'),
            );
            const base = newDraft(reportDate, entries, member.id);

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
    // Opened from the running timer ("?timer=edit" or "?timer=stop").
    useOpenFromQuery('timer', (params) =>
        setDraft(timerDraft(params.get('timer') === 'stop')),
    );
    useOpenFromQuery('absence', () => newAbsence(reportDate));
    const weekTotal = entries.reduce(
        (sum, entry) => sum + entry.durationSeconds,
        0,
    );
    const dayTotal = entries
        .filter((entry) => entry.date === date)
        .reduce((sum, entry) => sum + entry.durationSeconds, 0);
    const copyPeriodButton = canCopyPreviousPeriod && (
        <Tooltip delay={350} closeDelay={0}>
            <Tooltip.Trigger role="presentation" tabIndex={-1} className="flex">
                <Button
                    isIconOnly
                    variant="tertiary"
                    size={view === 'list' ? 'md' : 'lg'}
                    className={view === 'list' ? undefined : 'shadow-lg'}
                    onPress={() => setCopyOpen(true)}
                    aria-label={t(
                        view === 'day'
                            ? 'Copy previous day'
                            : 'Copy previous week',
                    )}
                    data-test="copy-week-button"
                >
                    <Copy aria-hidden="true" />
                </Button>
            </Tooltip.Trigger>
            <Tooltip.Content
                placement={view === 'list' ? 'bottom' : 'left'}
                showArrow
            >
                <Tooltip.Arrow />
                {t(
                    view === 'day'
                        ? 'Copy entries from the previous day'
                        : 'Copy entries from the previous week',
                )}
            </Tooltip.Content>
        </Tooltip>
    );

    const visit = (changes: { date?: string; view?: View; user?: number }) => {
        const nextView = changes.view ?? view;
        const route = nextView === 'list' ? list : index;

        return router.get(
            route.url(),
            {
                date: changes.date ?? date,
                ...(nextView === 'day' ? { view: nextView } : {}),
                user: changes.user ?? member.id,
            },
            { preserveScroll: true, preserveState: true, replace: true },
        );
    };

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

    const memberPicker = members.length > 1 && (
        <SelectField
            name="user"
            label={<span className="sr-only">{t('Member')}</span>}
            value={String(member.id)}
            onChange={(value) => visit({ user: Number(value) })}
            options={members}
            renderOption={({ label, avatar }) => (
                <span className="flex min-w-0 items-center gap-3 font-medium in-data-[slot=select-value]:gap-2">
                    <Avatar
                        size="sm"
                        variant="soft"
                        color="accent"
                        className="size-9 rounded-full in-data-[slot=select-value]:size-6"
                        aria-hidden="true"
                    >
                        {avatar && (
                            <Avatar.Image
                                src={avatar}
                                alt=""
                                className="object-cover"
                            />
                        )}
                        <Avatar.Fallback>{getInitials(label)}</Avatar.Fallback>
                    </Avatar>
                    <span className="truncate">{label}</span>
                </span>
            )}
            className="w-fit max-w-full min-w-0 gap-0"
            triggerClassName="h-9 items-center rounded-full bg-surface py-0 ps-[calc(--spacing(1.5)-var(--border-width-field))] pe-3 shadow-none"
            hideIndicator
            data-test="member-select"
        />
    );
    // Keyboard: N reports time, arrows step the period, I goes to today, L/V/D switch the view.
    // Quick presses step from where the previous one went, before its page has loaded.
    const step = view === 'day' ? 1 : 7;
    const stepTarget = useRef<{ from: string; to: string } | null>(null);
    const stepBy = (days: number) => {
        const from =
            stepTarget.current?.from === date ? stepTarget.current.to : date;
        const to = addDays(from, days);
        stepTarget.current = { from: date, to };
        visit({ date: to });
    };
    useShortcut('new', () => openReport('time'));
    useShortcut('previous', () => stepBy(-step));
    useShortcut('next', () => stepBy(step));
    useShortcut('today', () => visit({ date: today }));
    useShortcut('view-list', () => visit({ view: 'list' }));
    useShortcut('view-week', () => visit({ view: 'week' }));
    useShortcut('view-day', () => visit({ view: 'day' }));

    const periodPicker = (
        <CalendarPicker
            view={view}
            date={date}
            weekStart={weekStart}
            weekStartsOn={weekStartsOn}
            today={today}
            timezone={timezone}
            onChange={(date) => visit({ date })}
            onViewChange={(view) => visit({ view })}
        />
    );

    return (
        <>
            <Head title={pageTitle} />

            <div className="grid grid-cols-1 gap-3">
                <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
                    <Heading
                        className="items-center justify-start gap-x-3 gap-y-1"
                        title={pageTitle}
                        actions={
                            <p
                                className="flex items-baseline gap-1.5 text-xs tabular-nums"
                                data-test="week-total"
                            >
                                <span className="font-medium text-muted">
                                    {view === 'day'
                                        ? t('Day total')
                                        : t('Week total')}
                                </span>
                                <span className="font-semibold">
                                    {formatDuration(
                                        view === 'day' ? dayTotal : weekTotal,
                                    )}
                                </span>
                            </p>
                        }
                    />

                    <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2.5 md:ms-auto">
                        {isList && copyPeriodButton}
                        {memberPicker}
                        {periodPicker}
                        <TimeActionsMenu
                            className="hidden md:inline-flex"
                            placement="bottom end"
                            onStartTimer={onStartTimer}
                            onReport={openReport}
                            testId="new-time-button"
                        />
                    </div>
                </div>

                {/* Fades in when the week, day or view changes (not after saving an entry). */}
                <div
                    key={`${view}-${weekStart}-${view === 'day' ? date : ''}`}
                    className={cn(
                        'animate-fade-in',
                        view === 'list' && 'mx-auto w-full max-w-[76rem]',
                    )}
                >
                    {view === 'list' ? (
                        <TimeEntryList
                            dates={dates}
                            today={today}
                            entries={entries}
                            absences={absences}
                            colleaguesOff={colleaguesOff}
                            onEdit={(entry) => setDraft(draftFromEntry(entry))}
                            onEditAbsence={(absence) =>
                                setAbsenceDraft(draftFromAbsence(absence))
                            }
                            onAdd={(day) =>
                                setDraft(newDraft(day, entries, member.id))
                            }
                        />
                    ) : (
                        <TimeCalendar
                            view={view}
                            date={date}
                            weekStartsOn={weekStartsOn}
                            timezone={timezone}
                            entries={entries}
                            holidays={calendarHolidays}
                            absences={absences}
                            colleaguesOff={colleaguesOff}
                            floatingAction={copyPeriodButton}
                            hasSelectionDraft={draft?.openedFrom === 'calendar'}
                            onSelectDays={newAbsence}
                            onEditAbsence={(absence) =>
                                setAbsenceDraft(draftFromAbsence(absence))
                            }
                            timer={timerHere}
                            onEditTimer={() => setDraft(timerDraft(false))}
                            onSelect={(start, end) =>
                                setDraft({
                                    ...newDraft(
                                        start.slice(0, 10),
                                        entries,
                                        member.id,
                                    ),
                                    start: timeOf(start),
                                    end: timeOf(end),
                                    openedFrom: 'calendar',
                                })
                            }
                            onEdit={(entry) => setDraft(draftFromEntry(entry))}
                            onChange={move}
                        />
                    )}
                </div>
            </div>

            {/* Big "+" on mobile. */}
            <TimeActionsMenu
                large
                placement="top end"
                className={cn(
                    'fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg md:hidden',
                    // Above the running timer's bar.
                    timer &&
                        'bottom-[calc(7.75rem+env(safe-area-inset-bottom))]',
                    view !== 'list' &&
                        canCopyPreviousPeriod &&
                        'right-6 bottom-[calc(11rem+env(safe-area-inset-bottom))]',
                )}
                onStartTimer={onStartTimer}
                onReport={openReport}
                testId="new-time-fab"
            />

            <TimeEntryForm
                draft={draft}
                onClose={() => setDraft(null)}
                projects={projects}
                tags={tags}
                recentTags={recentTags}
                members={members}
                recentProjects={recentProjects}
                onCreate={
                    draft?.openedFrom === 'plus'
                        ? (seconds) =>
                              savePlusDurationMinutes(
                                  plusDurationKey,
                                  Math.round(seconds / 60),
                              )
                        : undefined
                }
                absence={{
                    absenceTypes,
                    recentAbsenceTypes,
                    holidays,
                    workdaySeconds,
                }}
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

            <AbsenceDialog
                draft={absenceDraft}
                onClose={() => setAbsenceDraft(null)}
                absenceTypes={absenceTypes}
                recentAbsenceTypes={recentAbsenceTypes}
                holidays={holidays}
                workdaySeconds={workdaySeconds}
            />

            <CopyPeriodDialog
                isOpen={isCopyOpen}
                onOpenChange={setCopyOpen}
                targetDay={view === 'day' ? date : undefined}
                entries={previousPeriodEntries}
            />
        </>
    );
}

TimeIndex.layout = { width: 'wide', compact: true };
