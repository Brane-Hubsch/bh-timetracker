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
                success: (message: string) => toast.success(message),
                info: (message: string) => toast.info(message),
                warning: (message: string) => toast.warning(message),
                error: (message: string) => toast.danger(message),
            }[data.type];

            show(data.message);
        });
    }, []);
}
