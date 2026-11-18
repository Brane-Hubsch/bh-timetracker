import { toast } from '@heroui/react';
import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { translate } from '@/lib/i18n';
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

            const undo = data.undo;
            const options = undo
                ? {
                      actionProps: {
                          children: translate(
                              document.documentElement.lang || 'sv',
                              'Undo',
                          ),
                          onPress: () =>
                              router.post(
                                  undo,
                                  {},
                                  { preserveScroll: true, preserveState: true },
                              ),
                          variant: 'tertiary' as const,
                      },
                  }
                : undefined;

            const show = {
                success: (message: string) => toast.success(message, options),
                info: (message: string) => toast.info(message, options),
                warning: (message: string) => toast.warning(message, options),
                error: (message: string) => toast.danger(message, options),
            }[data.type];

            show(data.message);
        });
    }, []);
}
