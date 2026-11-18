import { toast } from '@heroui/react';
import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import type { FlashToast } from '@/types/ui';

/**
 * Show `Inertia::flash('toast', [...])` messages from the backend as HeroUI toasts.
 */
export function useFlashToast(): void {
    useEffect(() => {
        return router.on('flash', (event) => {
            const flash = (event as CustomEvent).detail?.flash;
            const data = flash?.toast as FlashToast | undefined;

            if (!data) {
                return;
            }

            const show = {
                success: toast.success,
                info: toast.info,
                warning: toast.warning,
                error: toast.danger,
            }[data.type];

            show(data.message);
        });
    }, []);
}
