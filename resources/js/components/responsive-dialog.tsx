import { Drawer, Modal } from '@heroui/react';
import type { ReactNode } from 'react';
import { useIsDesktop } from '@/hooks/use-media-query';

type Props = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
};

/**
 * A modal on desktop and a bottom sheet (drawer) on mobile.
 */
export function ResponsiveDialog({
    isOpen,
    onOpenChange,
    title,
    children,
    footer,
}: Props) {
    const isDesktop = useIsDesktop();

    if (isDesktop) {
        return (
            <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-lg">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>{title}</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body>{children}</Modal.Body>
                        {footer && <Modal.Footer>{footer}</Modal.Footer>}
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        );
    }

    return (
        <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Drawer.Content placement="bottom">
                <Drawer.Dialog className="max-h-[92svh]">
                    <Drawer.Handle />
                    <Drawer.Header>
                        <Drawer.Heading>{title}</Drawer.Heading>
                    </Drawer.Header>
                    <Drawer.Body className="overflow-y-auto">
                        {children}
                    </Drawer.Body>
                    {footer && <Drawer.Footer>{footer}</Drawer.Footer>}
                </Drawer.Dialog>
            </Drawer.Content>
        </Drawer.Backdrop>
    );
}
