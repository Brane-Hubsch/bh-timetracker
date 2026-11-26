import { Drawer } from '@heroui/react';
import type { ReactNode } from 'react';
import { BottomSheetBackdrop } from '@/components/bottom-sheet-backdrop';
import { useIsDesktop } from '@/hooks/use-media-query';

type Props = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: ReactNode;
    headerActions?: ReactNode;
    /** `SideDrawerBody` and `SideDrawerFooter`, optionally wrapped in a form with `sideDrawerFormClass`. */
    children: ReactNode;
};

/** Classes for a form around the body and footer, so the body scrolls and the footer stays put. */
export const sideDrawerFormClass = 'flex min-h-0 flex-1 flex-col';

/**
 * A panel that slides in from the right on desktop and up from the bottom on mobile, for create/edit
 * forms that open on the page they belong to.
 */
export function SideDrawer({
    isOpen,
    onOpenChange,
    title,
    headerActions,
    children,
}: Props) {
    const isDesktop = useIsDesktop();

    const Backdrop = isDesktop ? Drawer.Backdrop : BottomSheetBackdrop;

    return (
        <Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Drawer.Content placement={isDesktop ? 'right' : 'bottom'}>
                <Drawer.Dialog
                    className={
                        isDesktop ? 'w-full max-w-xl sm:w-[36rem]' : undefined
                    }
                >
                    {isDesktop ? <Drawer.CloseTrigger /> : <Drawer.Handle />}
                    <Drawer.Header className="flex-row items-center justify-between pb-3">
                        <Drawer.Heading className="font-semibold max-md:text-[17px]/[21px] md:text-lg">
                            {title}
                        </Drawer.Heading>
                        {headerActions}
                    </Drawer.Header>
                    {children}
                </Drawer.Dialog>
            </Drawer.Content>
        </Backdrop>
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

/** Actions, pinned to the bottom of the panel; the body fades out above them instead of a divider. */
export function SideDrawerFooter({ children }: { children: ReactNode }) {
    return <Drawer.Footer className="mt-3">{children}</Drawer.Footer>;
}
