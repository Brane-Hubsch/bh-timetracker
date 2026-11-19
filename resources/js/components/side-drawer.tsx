import { Drawer } from '@heroui/react';
import type { ReactNode } from 'react';
import { useIsDesktop } from '@/hooks/use-media-query';

type Props = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: ReactNode;
    /** `SideDrawerBody` and `SideDrawerFooter`, optionally wrapped in a form with `sideDrawerFormClass`. */
    children: ReactNode;
};

/** Classes for a form around the body and footer, so the body scrolls and the footer stays put. */
export const sideDrawerFormClass = 'flex min-h-0 flex-1 flex-col';

/**
 * A panel that slides in from the right on desktop and up from the bottom on mobile, for create/edit
 * forms that open on the page they belong to.
 */
export function SideDrawer({ isOpen, onOpenChange, title, children }: Props) {
    const isDesktop = useIsDesktop();

    return (
        <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Drawer.Content placement={isDesktop ? 'right' : 'bottom'}>
                <Drawer.Dialog
                    className={
                        isDesktop
                            ? 'w-full max-w-xl sm:w-[36rem]'
                            : 'max-h-[92svh]'
                    }
                >
                    {isDesktop ? <Drawer.CloseTrigger /> : <Drawer.Handle />}
                    <Drawer.Header className="pb-3">
                        <Drawer.Heading className="text-lg font-semibold">
                            {title}
                        </Drawer.Heading>
                    </Drawer.Header>
                    {children}
                </Drawer.Dialog>
            </Drawer.Content>
        </Drawer.Backdrop>
    );
}

/** The scrollable content; groups are spaced apart. */
export function SideDrawerBody({ children }: { children: ReactNode }) {
    return (
        <Drawer.Body className="grid content-start gap-6 text-foreground">
            {children}
        </Drawer.Body>
    );
}

/** Actions, pinned to the bottom of the panel. */
export function SideDrawerFooter({ children }: { children: ReactNode }) {
    return (
        <Drawer.Footer className="-mx-6 -mb-6 border-t border-separator px-6 py-4">
            {children}
        </Drawer.Footer>
    );
}
