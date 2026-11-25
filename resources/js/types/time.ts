export type TimeEntry = {
    id: number;
    userId: number;
    project: {
        id: number;
        name: string;
        code: string | null;
        color: string;
        clientName: string | null;
    };
    description: string | null;
    /** Tag names, alphabetical. */
    tags: string[];
    /** Local date the entry starts on (YYYY-MM-DD). */
    date: string;
    /** Local wall-clock start/end (YYYY-MM-DDTHH:mm) in the viewer's time zone. */
    start: string;
    end: string;
    durationSeconds: number;
    isBillable: boolean;
};

export type ProjectOption = {
    value: string;
    label: string;
    color: string;
    clientName: string | null;
    isBillable: boolean;
    isRecent: boolean;
};

export type TimeEntryMemberOption = {
    value: string;
    label: string;
    avatar: string | null;
};

/** A saved organization holiday on a calendar date (YYYY-MM-DD). */
export type CalendarHoliday = { date: string; name: string };

export type TimeReportMode = 'time' | 'absence';

/** Values to start the time entry form with. */
export type TimeEntryDraft = {
    id?: number;
    openedFrom?: 'calendar' | 'plus';
    reportMode?: TimeReportMode;
    userId: number;
    projectId: string;
    description: string;
    tags: string[];
    date: string;
    start: string;
    end: string;
    isBillable: boolean | null;
    /** Editing the running timer instead of an entry. */
    timer?: boolean;
    /** Opened to stop the timer (it has no project, or ran long): ask for the end. */
    stopTimer?: boolean;
};

/** The signed-in person's running timer (shared with every page). */
export type RunningTimer = {
    organization: { slug: string; name: string };
    project: {
        id: number;
        name: string;
        color: string;
        clientName: string | null;
    } | null;
    description: string | null;
    tags: string[];
    isBillable: boolean | null;
    /** UTC instant (ISO 8601), for the ticking clock. */
    startedAt: string;
    /** Local wall-clock start (YYYY-MM-DDTHH:mm) in the viewer's time zone. */
    start: string;
    /** Has run long enough to ask for the end time when stopped. */
    isLong: boolean;
};

export type AbsenceType =
    | 'vacation'
    | 'child_care'
    | 'sick'
    | 'parental_leave'
    | 'leave_of_absence'
    | 'other';

export type AbsenceTypeOption = { value: AbsenceType; label: string };

/** The shown member's own absence, with its kind. */
export type Absence = {
    id: number;
    userId: number;
    type: AbsenceType;
    label: string;
    /** First and last day (YYYY-MM-DD), inclusive. */
    startsOn: string;
    endsOn: string;
    /** Null means full working days. */
    secondsPerDay: number | null;
    note: string | null;
};

/** A colleague's absence: only who and when, never the kind. */
export type ColleagueOff = {
    id: number;
    name: string;
    startsOn: string;
    endsOn: string;
};

/** Values to start the absence dialog with. */
export type AbsenceDraft = {
    id?: number;
    userId: number;
    type: AbsenceType;
    startsOn: string;
    endsOn: string;
    hoursPerDay: string;
    note: string;
};
