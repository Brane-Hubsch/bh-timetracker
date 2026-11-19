export type ClientListItem = {
    id: number;
    name: string;
    organizationNumber: string | null;
    email: string | null;
    activeProjectsCount: number;
    isArchived: boolean;
};

export type ClientDetails = {
    id: number;
    name: string;
    organizationNumber: string | null;
    email: string | null;
    notes: string | null;
    isArchived: boolean;
};

export type ProjectListItem = {
    id: number;
    name: string;
    code: string | null;
    color: string;
    client: { id: number; name: string } | null;
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
    id: number;
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
