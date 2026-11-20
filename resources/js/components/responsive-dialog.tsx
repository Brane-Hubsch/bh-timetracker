import { Drawer, Modal } from '@heroui/react';
import type { ComponentPropsWithRef, KeyboardEvent, ReactNode } from 'react';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useTranslation } from '@/lib/i18n';

type Props = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: ReactNode;
    headerActions?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    dismissOnEscape?: boolean;
    desktopClassName?: string;
    containerClassName?: string;
};

/** Dialog title and a plain close button, as in the TimeReport design. */
const headingClassName = 'text-xl/7 font-semibold';
const closeClassName =
    'size-8 rounded-lg bg-transparent text-foreground hover:bg-default';

/**
 * A modal on desktop and a bottom sheet (drawer) on mobile.
 */
export function ResponsiveDialog({
    isOpen,
    onOpenChange,
    title,
    headerActions,
    children,
    footer,
    dismissOnEscape,
    desktopClassName = 'sm:max-w-lg',
    containerClassName,
}: Props) {
    const isDesktop = useIsDesktop();
    const { t } = useTranslation();
    const headerClassName = headerActions
        ? 'flex-row items-center justify-between gap-2'
        : undefined;

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
                <Modal.Container className={containerClassName}>
                    <Modal.Dialog
                        className={desktopClassName}
                        render={renderDialog}
                    >
                        {!headerActions && (
                            <Modal.CloseTrigger className={closeClassName} />
                        )}
                        <Modal.Header className={headerClassName}>
                            <Modal.Heading className={headingClassName}>
                                {title}
                            </Modal.Heading>
                            {headerActions && (
                                <div className="flex shrink-0 items-center gap-2">
                                    {headerActions}
                                    <Modal.CloseTrigger
                                        className={`static ${closeClassName}`}
                                        aria-label={t('Close')}
                                    />
                                </div>
                            )}
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
            <Drawer.Content placement="bottom" className={containerClassName}>
                <Drawer.Dialog className="max-h-[92svh]" render={renderDialog}>
                    <Drawer.Handle />
                    <Drawer.Header className={headerClassName}>
                        <Drawer.Heading className={headingClassName}>
                            {title}
                        </Drawer.Heading>
                        {headerActions && (
                            <div className="flex shrink-0 items-center gap-2">
                                {headerActions}
                                <Drawer.CloseTrigger
                                    className={`static ${closeClassName}`}
                                    aria-label={t('Close')}
                                />
                            </div>
                        )}
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
