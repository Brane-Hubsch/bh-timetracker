import { Avatar, Button, Tooltip } from '@heroui/react';
import { Head, router, usePage } from '@inertiajs/react';
import { Copy, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { Temporal } from 'temporal-polyfill';
import { MobilePageHeader } from '@/components/app-shell/mobile-page-header';
import { SelectField } from '@/components/form/select-field';
import Heading from '@/components/heading';
import {
    AbsenceDialog,
    draftFromAbsence,
} from '@/components/time/absence-dialog';
import { CalendarPicker } from '@/components/time/calendar-picker';
import { CalendarSwipe } from '@/components/time/calendar-swipe';
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
import { useMediaQuery } from '@/hooks/use-media-query';
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

type CalendarPreview = Pick<
    Props,
    'date' | 'entries' | 'absences' | 'colleaguesOff' | 'calendarHolidays'
>;

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
    const {
        props: { auth, can, currentOrganization, timer },
        url,
    } = usePage();
    const isMobile = useMediaQuery('(width < 768px)');
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
    const periodUrl = new URL(url, 'http://localhost');
    const needsMobileDay =
        isMobile && view === 'week' && !periodUrl.searchParams.has('view');
    const pageTitle = t(isList ? 'List' : 'Calendar');

    const [draft, setDraft] = useState<TimeEntryDraft | null>(null);
    const [isCopyOpen, setCopyOpen] = useState(false);
    const [absenceDraft, setAbsenceDraft] = useState<AbsenceDraft | null>(null);
    const [previews, setPreviews] = useState<{
        from: string;
        periods: Partial<Record<-1 | 1, CalendarPreview>>;
    } | null>(null);
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
    const reportDate =
        (isMobile && view === 'day') || !dates.includes(today) ? date : today;
    const openReport = (mode: TimeReportMode) =>
        setDraft(
            newPlusDraft(
                newDraft(reportDate, entries, member.id),
                mode,
                timezone,
                plusDurationKey,
            ),
        );

    const queryOptions = { enabled: !needsMobileDay };
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
        { ...queryOptions, alsoRemove: ['project'] },
    );
    useOpenFromQuery('copy', () => setCopyOpen(true), queryOptions);
    // Opened from the running timer ("?timer=edit" or "?timer=stop").
    useOpenFromQuery(
        'timer',
        (params) => setDraft(timerDraft(params.get('timer') === 'stop')),
        queryOptions,
    );
    useOpenFromQuery('absence', () => newAbsence(reportDate), queryOptions);

    useEffect(() => {
        if (!needsMobileDay) {
            return;
        }

        const next = new URL(url, window.location.origin);
        next.searchParams.set('view', 'day');
        // The server has to rebuild the period data for the new view.
        router.get(
            next,
            {},
            {
                replace: true,
                preserveState: true,
                preserveScroll: true,
                showProgress: false,
            },
        );
    }, [needsMobileDay, url]);

    const calendarHeader = useRef<HTMLDivElement>(null);
    const calendarGrid = useRef<HTMLDivElement>(null);
    const didSetMobileScroll = useRef(false);
    useEffect(() => {
        if (isList) {
            didSetMobileScroll.current = false;
        }

        if (
            !isMobile ||
            isList ||
            needsMobileDay ||
            didSetMobileScroll.current
        ) {
            return;
        }

        const grid = calendarGrid.current;
        if (!grid) {
            return;
        }

        // FullCalendar measures the slots after mount. Wait for their full height
        // before setting the page scroll, and keep an existing scroll position.
        const observer = new ResizeObserver(() => {
            const header = calendarHeader.current;
            const morning = grid.querySelector('.time-calendar-morning');
            const slot = morning?.getBoundingClientRect();
            if (!header || !slot || slot.height < 20) {
                return;
            }

            didSetMobileScroll.current = true;
            observer.disconnect();
            if (window.scrollY < header.offsetHeight) {
                window.scrollTo(
                    0,
                    window.scrollY + slot.top - header.offsetHeight - 12,
                );
            }
        });
        observer.observe(grid.querySelector('.time-calendar-morning') ?? grid);

        return () => observer.disconnect();
    }, [isList, isMobile, needsMobileDay, view]);

    const weekTotal = entries.reduce(
        (sum, entry) => sum + entry.durationSeconds,
        0,
    );
    const dayTotal = entries
        .filter((entry) => entry.date === date)
        .reduce((sum, entry) => sum + entry.durationSeconds, 0);
    const copyInToolbar = isList && !isMobile;
    const copyPeriodButton = canCopyPreviousPeriod && (
        <Tooltip delay={350} closeDelay={0}>
            <Tooltip.Trigger role="presentation" tabIndex={-1} className="flex">
                <Button
                    isIconOnly
                    variant="tertiary"
                    size={copyInToolbar ? 'md' : 'lg'}
                    className={cn(
                        !copyInToolbar &&
                            'shadow-lg max-md:size-11 max-md:rounded-full max-md:border max-md:border-accent/20 max-md:bg-[color-mix(in_oklab,var(--accent)_8%,var(--surface))] max-md:text-accent max-md:[&_svg]:size-4',
                    )}
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
                placement={copyInToolbar ? 'bottom' : 'left'}
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

    const pageData = (changes: {
        date?: string;
        view?: View;
        user?: number;
    }) => {
        const nextView = changes.view ?? view;
        const route = nextView === 'list' ? list : index;

        return {
            href: route.url(),
            data: {
                date: changes.date ?? date,
                ...(nextView === 'day' || (nextView === 'week' && isMobile)
                    ? { view: nextView }
                    : {}),
                user: changes.user ?? member.id,
            },
        };
    };
    const visit = (
        changes: Parameters<typeof pageData>[0],
        onFinish?: () => void,
    ) => {
        const { href, data } = pageData(changes);

        router.get(href, data, {
            preserveScroll:
                !isMobile ||
                !changes.view ||
                (changes.view === 'list') === isList,
            preserveState: true,
            replace: true,
            showProgress: !onFinish,
            onFinish,
        });
    };

    const step = view === 'day' ? 1 : 7;
    const adjacentDate = (direction: -1 | 1) => addDays(date, step * direction);
    const swipeToPeriod = (direction: -1 | 1, onFinish: () => void) =>
        visit({ date: adjacentDate(direction) }, onFinish);

    function prefetchPeriod(direction: -1 | 1) {
        const nextDate = adjacentDate(direction);
        const { href, data } = pageData({ date: nextDate });

        router.prefetch(
            href,
            {
                data,
                onPrefetched: isList
                    ? undefined
                    : (response) => {
                          const { props } = JSON.parse(response.data) as {
                              props: CalendarPreview;
                          };
                          if (props.date === nextDate) {
                              const {
                                  date,
                                  entries,
                                  absences,
                                  colleaguesOff,
                                  calendarHolidays,
                              } = props;
                              setPreviews((previous) => ({
                                  from: url,
                                  periods: {
                                      ...(previous?.from === url &&
                                          previous.periods),
                                      [direction]: {
                                          date,
                                          entries,
                                          absences,
                                          colleaguesOff,
                                          calendarHolidays,
                                      },
                                  },
                              }));
                          }
                      },
            },
            // Start the request while the finger is down and reuse it on release.
            { cacheFor: '5s' },
        );
    }

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

    const mobileAvatar = isMobile;
    const memberPicker = (mobileAvatar
        ? can?.canManageTeamTime && members.length > 0
        : members.length > 1) && (
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
                        className={cn(
                            'size-9 rounded-full in-data-[slot=select-value]:size-6',
                            mobileAvatar &&
                                'in-data-[slot=select-value]:size-[38px] in-data-[slot=select-value]:text-base',
                        )}
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
                    <span
                        className={cn(
                            'truncate',
                            mobileAvatar &&
                                'in-data-[slot=select-value]:sr-only',
                        )}
                    >
                        {label}
                    </span>
                </span>
            )}
            className={cn(
                'w-fit max-w-full min-w-0 gap-0',
                mobileAvatar && 'order-last shrink-0',
            )}
            triggerClassName={cn(
                'h-9 items-center rounded-full bg-surface py-0 ps-[calc(--spacing(1.5)-var(--border-width-field))] pe-3 shadow-none',
                mobileAvatar &&
                    'size-10 justify-center border-0 bg-transparent p-0',
            )}
            triggerAriaLabel={mobileAvatar ? t('Member') : undefined}
            hideIndicator
            data-test="member-select"
        />
    );
    // Keyboard: N reports time, arrows step the period, I goes to today, L/V/D switch the view.
    // Quick presses step from where the previous one went, before its page has loaded.
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

    const calendarProps: Omit<ComponentProps<typeof TimeCalendar>, 'view'> = {
        date,
        weekStartsOn,
        timezone,
        entries,
        holidays: calendarHolidays,
        absences,
        colleaguesOff,
        floatingAction: copyPeriodButton,
        hasSelectionDraft: draft?.openedFrom === 'calendar',
        onSelectDays: newAbsence,
        onEditAbsence: (absence) => setAbsenceDraft(draftFromAbsence(absence)),
        timer: timerHere,
        onEditTimer: () => setDraft(timerDraft(false)),
        onSelect: (start, end) =>
            setDraft({
                ...newDraft(start.slice(0, 10), entries, member.id),
                start: timeOf(start),
                end: timeOf(end),
                openedFrom: 'calendar',
            }),
        onEdit: (entry) => setDraft(draftFromEntry(entry)),
        onChange: move,
    };

    return (
        <>
            <Head title={pageTitle} />

            <div className="grid grid-cols-1 md:gap-3">
                <MobilePageHeader
                    ref={calendarHeader}
                    className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 max-md:gap-1.5"
                >
                    <Heading
                        className="items-center justify-start gap-x-3 gap-y-1 max-md:shrink-0 max-md:flex-col max-md:items-start max-md:gap-0 max-md:[&_h1]:text-[19px]/[24px]"
                        title={pageTitle}
                        actions={
                            <p
                                className={cn(
                                    'flex items-baseline gap-1.5 text-xs tabular-nums',
                                    isList
                                        ? 'max-md:text-[13.5px]/[17px]'
                                        : 'max-md:text-[12.5px]/[17px]',
                                )}
                                data-test="week-total"
                            >
                                <span
                                    className={cn(
                                        'font-medium text-muted',
                                        view === 'day' && 'max-md:font-normal',
                                    )}
                                >
                                    {view === 'day'
                                        ? t('Day total')
                                        : t('Week total')}
                                </span>
                                <span
                                    className={cn(
                                        'font-semibold',
                                        view === 'day' && 'max-md:font-medium',
                                    )}
                                >
                                    {formatDuration(
                                        view === 'day' ? dayTotal : weekTotal,
                                    )}
                                </span>
                            </p>
                        }
                    />

                    <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2.5 max-md:flex-nowrap max-md:gap-1.5 md:ms-auto">
                        {copyInToolbar && copyPeriodButton}
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
                </MobilePageHeader>

                <div
                    key={`${view}-${weekStart}-${view === 'day' ? date : ''}`}
                    ref={calendarGrid}
                    className={
                        isList ? 'mx-auto w-full md:max-w-[76rem]' : undefined
                    }
                >
                    {view === 'list' ? (
                        <TimeEntryList
                            dates={dates}
                            today={today}
                            entries={entries}
                            absences={absences}
                            colleaguesOff={colleaguesOff}
                            holidays={calendarHolidays}
                            pageHeaderRef={calendarHeader}
                            isMobile={isMobile}
                            hasTimer={Boolean(timer)}
                            onSwipe={swipeToPeriod}
                            onSwipeIntent={prefetchPeriod}
                            onEdit={(entry) => setDraft(draftFromEntry(entry))}
                            onEditAbsence={(absence) =>
                                setAbsenceDraft(draftFromAbsence(absence))
                            }
                            onAdd={(day) =>
                                setDraft(newDraft(day, entries, member.id))
                            }
                        />
                    ) : isMobile ? (
                        <CalendarSwipe
                            onSwipeIntent={prefetchPeriod}
                            onSwipe={swipeToPeriod}
                            renderAdjacent={(direction) => {
                                const nextDate = adjacentDate(direction);
                                const preview =
                                    previews?.from === url
                                        ? previews.periods[direction]
                                        : undefined;
                                const adjacent =
                                    preview?.date === nextDate
                                        ? preview
                                        : undefined;

                                return (
                                    <TimeCalendar
                                        {...calendarProps}
                                        view={view}
                                        date={nextDate}
                                        entries={adjacent?.entries ?? entries}
                                        absences={
                                            adjacent?.absences ?? absences
                                        }
                                        colleaguesOff={
                                            adjacent?.colleaguesOff ??
                                            colleaguesOff
                                        }
                                        holidays={
                                            adjacent?.calendarHolidays ?? []
                                        }
                                        floatingAction={undefined}
                                        isPreview
                                    />
                                );
                            }}
                        >
                            <TimeCalendar {...calendarProps} view={view} />
                        </CalendarSwipe>
                    ) : (
                        <TimeCalendar {...calendarProps} view={view} />
                    )}
                </div>
            </div>

            {/* Floating time-report button on mobile. */}
            <div
                className={cn(
                    'fixed right-4 z-30 flex flex-col items-center gap-3 md:hidden',
                    timer &&
                        'bottom-[calc(var(--mobile-tab-bar-height)+4.1875rem)]',
                    !timer &&
                        'bottom-[calc(var(--mobile-tab-bar-height)+1rem)]',
                )}
            >
                {!copyInToolbar && copyPeriodButton}
                <Button
                    isIconOnly
                    aria-label={t('Report time')}
                    className="size-12 rounded-full shadow-lg"
                    onPress={() => openReport('time')}
                    data-test="new-time-fab"
                >
                    <Plus aria-hidden="true" className="size-6" />
                </Button>
            </div>

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
