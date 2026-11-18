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

/** Values to start the time entry form with. */
export type TimeEntryDraft = {
    id?: number;
    userId: number;
    projectId: string;
    description: string;
    date: string;
    start: string;
    end: string;
    isBillable: boolean | null;
};
