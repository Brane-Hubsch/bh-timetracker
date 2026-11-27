export type OrganizationRole = 'owner' | 'admin' | 'member';

export type Organization = {
    id: number;
    name: string;
    slug: string;
    role?: OrganizationRole;
    roleLabel?: string;
    isCurrent?: boolean;
    hasTeam?: boolean;
    /** Whether members may use the timer. */
    timerEnabled?: boolean;
    /** Logo URL (128 px), or null without a logo. */
    logo?: string | null;
};

export type OrganizationSettings = Organization & {
    currency: string;
    /** Minor currency unit (öre); null for members who may not see rates. */
    defaultHourlyRate: number | null;
    /** ISO-8601 weekday, 1 = Monday. */
    weekStartsOn: number;
    timezone: string;
    /** Hours a full absence day counts as. */
    workdayHours: number;
    timerEnabled: boolean;
    /** Brand accent for members without their own; null is the default violet. */
    accent: import('@/lib/theme').AccentName | null;
    /** Logo URL in preview size (256 px), or null without a logo. */
    logo: string | null;
};

export type OrganizationMember = {
    id: number;
    name: string;
    email: string;
    avatar?: string | null;
    role: OrganizationRole;
    role_label: string;
    /** Minor currency unit; null when not set or not visible to the viewer. */
    hourly_rate: number | null;
    is_deactivated: boolean;
};

export type OrganizationInvitation = {
    code: string;
    email: string;
    role: OrganizationRole;
    role_label: string;
    created_at: string;
};

export type OrganizationInvitationContext = {
    code: string;
    organizationName: string;
};

export type DashboardInvitation = {
    code: string;
    inviterName: string;
    organization: {
        name: string;
        slug: string;
    };
};

export type OrganizationPermissions = {
    canUpdateOrganization: boolean;
    canDeleteOrganization: boolean;
    canAddMember: boolean;
    canUpdateMember: boolean;
    canRemoveMember: boolean;
    canCreateInvitation: boolean;
    canCancelInvitation: boolean;
    canManageClients: boolean;
    canManageProjects: boolean;
    canManageTags: boolean;
    canManageTeamTime: boolean;
    canViewRates: boolean;
};

export type RoleOption = {
    value: OrganizationRole;
    label: string;
};

export type TeamOrganization = Pick<
    OrganizationSettings,
    'id' | 'slug' | 'name' | 'currency' | 'weekStartsOn' | 'workdayHours'
>;

export type TeamSchedule = {
    weekStartsOn: number | null;
    workingDays: number[];
    workdayHours: number | null;
};

export type TeamMember = {
    id: number;
    name: string;
    email: string;
    role: OrganizationRole;
    roleLabel: string;
    avatar: string | null;
    hourlyRate?: number | null;
    isDeactivated: boolean;
    canEdit: boolean;
    hasTeamAvatar?: boolean;
    schedule?: TeamSchedule;
};
