import { toast } from '@heroui/react';
import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { translate } from '@/lib/i18n';
import type { FlashToast } from '@/types/ui';

/**
 * Show `Inertia::flash('toast', [...])` messages from the backend, and network errors, as HeroUI toasts.
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
            let isUndoing = false;
            const options = undo
                ? {
                      actionProps: {
                          children: translate(
                              document.documentElement.lang || 'sv',
                              'Undo',
                          ),
                          onPress: () => {
                              if (isUndoing) return;

                              isUndoing = true;
                              router.post(
                                  undo,
                                  {},
                                  {
                                      preserveScroll: true,
                                      preserveState: true,
                                      onSuccess: () => toast.close(toastId),
                                      onFinish: () => {
                                          isUndoing = false;
                                      },
                                  },
                              );
                          },
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

            const toastId = show(data.message);
        });
    }, []);

    // Lost connection (offline, server unreachable): keep the page and say so.
    useEffect(() => {
        return router.on('networkError', () => {
            toast.danger(
                translate(
                    document.documentElement.lang || 'sv',
                    'Could not reach the server. Check your connection and try again.',
                ),
            );
        });
    }, []);
}
