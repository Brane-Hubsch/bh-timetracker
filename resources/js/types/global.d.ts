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
            [key: string]: unknown;
        };
        layoutProps: {
            width: import('@/types/ui').ContentWidth;
        };
    }
}

declare module 'react-aria-components' {
    interface RouterConfig {
        routerOptions: import('@inertiajs/core').VisitOptions;
    }
}
