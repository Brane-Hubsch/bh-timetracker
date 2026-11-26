import { Drawer } from '@heroui/react';
import type { ComponentPropsWithoutRef } from 'react';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { useIsDesktop } from '@/hooks/use-media-query';

/** Lets the bottom drawer follow the visual viewport while HeroUI locks page scroll. */
export function BottomSheetBackdrop(
    props: Omit<ComponentPropsWithoutRef<typeof Drawer.Backdrop>, 'className'>,
) {
    const isDesktop = useIsDesktop();
    const keyboardInsetRef = useKeyboardInset();

    return (
        <Drawer.Backdrop
            {...props}
            ref={isDesktop ? undefined : keyboardInsetRef}
            className="keyboard-aware-sheet"
        />
    );
}
