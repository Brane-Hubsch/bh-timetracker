import type { SelectOption } from '@/components/form/select-field';
import type { AbsenceType, AbsenceTypeOption } from './time';

export type ReportGroupingKey =
    | 'client'
    | 'project'
    | 'member'
    | 'tag'
    | 'day'
    | 'week'
    | 'month';

/** Report filters as they live in the URL. */
export type ReportFilterValues = {
    period: string;
    from: string;
    to: string;
    members: string[];
    clients: string[];
    projects: string[];
    tags: string[];
    billable: string | null;
    group: ReportGroupingKey;
    subgroup: ReportGroupingKey | 'none';
    scale: 'week' | 'month' | null;
    sort: 'date' | 'duration' | 'project' | 'member';
    direction: 'asc' | 'desc';
};

export type ReportMemberOption = SelectOption & {
    avatar: string | null;
    isInactive: boolean;
};

export type ReportClientOption = SelectOption & { logo: string | null };

export type ReportProjectOption = SelectOption & {
    name: string;
    client: string | null;
    color: string;
};

export type ReportOptions = {
    periods: SelectOption[];
    groupings: SelectOption[];
    members: ReportMemberOption[];
    clients: ReportClientOption[];
    projects: ReportProjectOption[];
    tags: SelectOption[];
};

export type ReportAbilities = {
    canViewTeam: boolean;
    canViewAmounts: boolean;
};

/** Seconds, and the amount in minor units (null when the viewer may not see amounts). */
export type ReportTotals = {
    seconds: number;
    billableSeconds: number;
    amount: number | null;
};

export type ReportGroup = ReportTotals & {
    key: string;
    label: string;
    color: string | null;
    children: ReportGroup[];
};

export type TimelineBucket = {
    /** First local date of the bucket (YYYY-MM-DD). */
    key: string;
    seconds: number;
    billableSeconds: number;
    projectSeconds?: Record<number, number>;
};

export type TimelineProject = {
    id: number;
    name: string;
    clientName: string | null;
    color: string;
};

export type ProjectShare = {
    id: number | null;
    name: string;
    color: string | null;
    clientName: string | null;
    seconds: number;
};

export type ReportSummary = {
    totals: ReportTotals;
    groups: ReportGroup[];
    timeline: {
        unit: 'day' | 'week' | 'month';
        buckets: TimelineBucket[];
        projects?: TimelineProject[];
    };
    projects: ProjectShare[];
};

export type ReportRow = {
    id: number;
    userId: number;
    memberName: string;
    project: {
        id: number;
        name: string;
        code: string | null;
        color: string;
        clientName: string | null;
    };
    description: string | null;
    tags: string[];
    date: string;
    start: string;
    end: string;
    durationSeconds: number;
    isBillable: boolean;
    hourlyRate: number | null;
    amount: number | null;
};

export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
};

export type FollowUpProject = {
    id: number;
    slug: string;
    name: string;
    code: string | null;
    color: string;
    clientName: string | null;
    estimateSeconds: number | null;
    consumedSeconds: number;
    billableSeconds: number;
    remainingSeconds: number | null;
    percent: number | null;
};

/** Absence in the report period per member and type, in seconds. */
export type ReportAbsence = {
    /** Seconds a full absence day counts as. */
    workdaySeconds: number;
    types: AbsenceTypeOption[];
    members: {
        id: number;
        name: string;
        seconds: number;
        types: Partial<Record<AbsenceType, number>>;
    }[];
};
