import type { Auth } from '@/types/auth';
import type {
    Organization,
    OrganizationPermissions,
} from '@/types/organizations';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            locale: string;
            auth: Auth;
            sidebarOpen: boolean;
            currentOrganization: Organization | null;
            organizations: Organization[];
            /** Permissions in the current organization. */
            can: OrganizationPermissions | null;
            /** The signed-in person's running timer, in any of their organizations. */
            timer: import('@/types/time').RunningTimer | null;
            [key: string]: unknown;
        };
        flashDataType: {
            toast?: import('@/types/ui').FlashToast;
            importResult?: import('@/types/imports').ImportResult;
            projectImportResult?: import('@/types/imports').ProjectImportResult;
        };
        layoutProps: {
            width: import('@/types/ui').ContentWidth;
            compact: boolean;
        };
    }
}

declare module 'react-aria-components' {
    interface RouterConfig {
        routerOptions: import('@inertiajs/core').VisitOptions;
    }
}
