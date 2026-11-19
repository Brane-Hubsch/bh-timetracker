import { router, usePage } from '@inertiajs/react';
import { switchMethod } from '@/routes/organizations';
import type { Organization } from '@/types';

/**
 * Switch the active organization. On tenant pages the URL's organization segment is replaced so the
 * user stays on the same page in the new organization.
 */
export function useSwitchOrganization(): (
    organization: Pick<Organization, 'slug'>,
) => void {
    const { currentOrganization } = usePage().props;

    return (organization) => {
        const previousSlug = currentOrganization?.slug;

        router.visit(switchMethod(organization.slug), {
            onFinish: () => {
                const path = window.location.pathname;
                const segment = `/${previousSlug}/`;

                if (previousSlug && path.startsWith(segment)) {
                    router.visit(
                        path.replace(segment, `/${organization.slug}/`) +
                            window.location.search,
                        { replace: true },
                    );

                    return;
                }

                router.reload();
            },
        });
    };
}
