import { Drawer, Modal } from '@heroui/react';
import type { ComponentPropsWithRef, KeyboardEvent, ReactNode } from 'react';
import { useIsDesktop } from '@/hooks/use-media-query';

type Props = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    dismissOnEscape?: boolean;
    desktopClassName?: string;
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
    dismissOnEscape,
    desktopClassName = 'sm:max-w-lg',
}: Props) {
    const isDesktop = useIsDesktop();

    const onKeyDownCapture = (event: KeyboardEvent<HTMLElement>) => {
        // Catch Escape before an open field popover handles it.
        if (
            isOpen &&
            dismissOnEscape === true &&
            event.key === 'Escape' &&
            !event.nativeEvent.isComposing
        ) {
            event.preventDefault();
            event.stopPropagation();
            onOpenChange(false);
        }
    };
    const renderDialog = (props: ComponentPropsWithRef<'section'>) => (
        <section {...props} onKeyDownCapture={onKeyDownCapture} />
    );

    if (isDesktop) {
        return (
            <Modal.Backdrop
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                isKeyboardDismissDisabled={dismissOnEscape === false}
            >
                <Modal.Container>
                    <Modal.Dialog
                        className={desktopClassName}
                        render={renderDialog}
                    >
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
        <Drawer.Backdrop
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            isKeyboardDismissDisabled={dismissOnEscape === false}
        >
            <Drawer.Content placement="bottom">
                <Drawer.Dialog className="max-h-[92svh]" render={renderDialog}>
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
