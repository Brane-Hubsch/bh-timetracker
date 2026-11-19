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

/** Values to start the time entry form with. */
export type TimeEntryDraft = {
    id?: number;
    fromCalendar?: boolean;
    userId: number;
    projectId: string;
    description: string;
    tags: string[];
    date: string;
    start: string;
    end: string;
    isBillable: boolean | null;
};
