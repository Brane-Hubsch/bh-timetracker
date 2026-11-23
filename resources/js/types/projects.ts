export type ClientNameOption = {
    id: number;
    slug: string;
    name: string;
    isArchived: boolean;
};

export type ClientListItem = ClientNameOption & {
    organizationNumber: string | null;
    email: string | null;
    /** Logo URL (128 px), or null without a logo. */
    logo: string | null;
    activeProjectsCount: number;
    archivedProjectsCount: number;
};

export type ClientDetails = {
    id: number;
    slug: string;
    name: string;
    organizationNumber: string | null;
    email: string | null;
    website: string | null;
    notes: string | null;
    /** Logo URL (256 px), or null without a logo. */
    logo: string | null;
    isArchived: boolean;
};

export type ProjectListItem = {
    id: number;
    slug: string;
    name: string;
    code: string | null;
    color: string;
    client: {
        id: number;
        slug: string;
        name: string;
        logo: string | null;
    } | null;
    isBillable: boolean;
    estimateSeconds: number | null;
    isPrivate: boolean;
    isArchived: boolean;
    /** All time reported on the project. */
    consumedSeconds: number;
};

export type ProjectDetails = ProjectListItem & {
    /** Minor currency unit; null when not set or not visible to the viewer. */
    hourlyRate: number | null;
    visibility: 'public' | 'private';
    startsOn: string | null;
    endsOn: string | null;
    /** Free text for everyone on the project (e.g. scope, contacts, links). */
    notes: string | null;
};

export type ProjectFormValues = {
    slug: string;
    name: string;
    clientId: number | null;
    code: string | null;
    color: string;
    isBillable: boolean;
    hourlyRate: number | null;
    estimateSeconds: number | null;
    visibility: 'public' | 'private';
    startsOn: string | null;
    endsOn: string | null;
    notes: string | null;
};

/** Choices for the project form; only sent to users who may create or edit projects. */
export type ProjectFormOptions = {
    clients: { value: string; label: string }[];
    colors: string[];
    currency: string;
};

export type ProjectMemberItem = {
    id: number;
    name: string;
    email: string;
    avatar: string | null;
    hourlyRate: number | null;
};

/** How a project stands against its estimate (dates are local YYYY-MM-DD). */
export type EstimatePace = {
    /** Seconds left to 100 % of the estimate; negative when over it. */
    remainingSeconds: number;
    /** Working days from today (or the start) to the end date; null without an end date. */
    workdaysLeft: number | null;
    /** Seconds needed per working day; null when reached or no working days are left. */
    secondsPerWorkday: number | null;
    from: string | null;
    to: string | null;
};
