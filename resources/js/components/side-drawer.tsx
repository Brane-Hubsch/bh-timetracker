import { Drawer } from '@heroui/react';
import type { FormEvent, ReactNode } from 'react';
import { useIsDesktop } from '@/hooks/use-media-query';

type Props = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: ReactNode;
    children: ReactNode;
    /** Actions, pinned to the bottom of the panel. */
    footer?: ReactNode;
    /** Wrap body and footer in a form so the footer's submit button submits it. */
    onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
};

/**
 * A panel that slides in from the right on desktop and up from the bottom on mobile. For larger
 * forms (create/edit a project) that need more room than a dialog, without leaving the page.
 */
export function SideDrawer({
    isOpen,
    onOpenChange,
    title,
    children,
    footer,
    onSubmit,
}: Props) {
    const isDesktop = useIsDesktop();

    const content = (
        <>
            <Drawer.Body className="grid content-start gap-6 text-foreground">
                {children}
            </Drawer.Body>
            {footer && (
                <Drawer.Footer
                    className={
                        isDesktop
                            ? '-mx-6 -mb-6 border-t border-separator px-6 py-4'
                            : ''
                    }
                >
                    {footer}
                </Drawer.Footer>
            )}
        </>
    );

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
                    {onSubmit ? (
                        <form
                            onSubmit={onSubmit}
                            className="flex min-h-0 flex-1 flex-col"
                        >
                            {content}
                        </form>
                    ) : (
                        content
                    )}
                </Drawer.Dialog>
            </Drawer.Content>
        </Drawer.Backdrop>
    );
}
