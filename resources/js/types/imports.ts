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
        /** Hourly rate per member with time on the project; null when the viewer may not see rates. */
        rates: ImportRate[] | null;
    }[];
    /** The organization's currency, for the rate fields. */
    currency: string;
    /** Rows an earlier import created, which can get the new rates instead. */
    alreadyImported: number;
    newClients: string[];
    skipped: SkippedImportRow[];
    skippedCount: number;
    /** Skipped rows per reason, over all of them (the list above is capped). */
    skippedReasons: { reason: string; count: number }[];
};

/** A member's hourly rate on a project in the import preview (minor units). */
export type ImportRate = {
    memberId: number;
    name: string;
    avatar: string | null;
    entries: number;
    seconds: number;
    /** What the rate order gives. */
    defaultRate: number | null;
    /** The rate that applies (chosen or default). */
    rate: number | null;
};

export type ImportResult = {
    created: number;
    updated: number;
    seconds: number;
    clientsCreated: number;
    projectsCreated: number;
    from: string | null;
    to: string | null;
    skipped: SkippedImportRow[];
    skippedCount: number;
};
