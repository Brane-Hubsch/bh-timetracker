/** Clockify import: the preview of an uploaded export and the result of an import. */
export type SkippedImportRow = {
    line: number;
    date: string | null;
    user: string | null;
    project: string | null;
    reason: string;
};

export type ImportPreview = {
    token: string;
    dateFormat: string;
    timezone: string;
    from: string | null;
    to: string | null;
    rows: number;
    importable: number;
    importableSeconds: number;
    members: {
        email: string;
        name: string;
        entries: number;
        seconds: number;
        memberId: number | null;
        matched: boolean;
    }[];
    projects: {
        key: string;
        name: string;
        client: string | null;
        isNew: boolean;
        isArchived: boolean;
        billable: boolean;
        entries: number;
        seconds: number;
    }[];
    newClients: string[];
    skipped: SkippedImportRow[];
    skippedCount: number;
    /** Skipped rows per reason, over all of them (the list above is capped). */
    skippedReasons: { reason: string; count: number }[];
};

export type ImportResult = {
    created: number;
    seconds: number;
    clientsCreated: number;
    projectsCreated: number;
    from: string | null;
    to: string | null;
    skipped: SkippedImportRow[];
    skippedCount: number;
};
