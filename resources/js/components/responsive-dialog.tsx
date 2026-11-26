import { Drawer, Modal } from '@heroui/react';
import type { ComponentPropsWithRef, KeyboardEvent, ReactNode } from 'react';
import { useIsDesktop } from '@/hooks/use-media-query';
import { useTranslation } from '@/lib/i18n';

type Props = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: ReactNode;
    headerContent?: ReactNode;
    wrapContent?: (content: ReactNode) => ReactNode;
    closeInHeader?: boolean;
    children: ReactNode;
    footer?: ReactNode;
    dismissOnEscape?: boolean;
    /** The form ⌘/Ctrl+Enter submits from anywhere in the dialog. */
    submitFormId?: string;
    /** What ⌘/Ctrl+Enter does instead of submitting a form (e.g. stop the timer). */
    onSubmitShortcut?: () => void;
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
    headerContent,
    wrapContent = (content) => content,
    closeInHeader,
    children,
    footer,
    dismissOnEscape,
    submitFormId,
    onSubmitShortcut,
    desktopClassName = 'sm:max-w-lg',
    containerClassName,
}: Props) {
    const isDesktop = useIsDesktop();
    const { t } = useTranslation();
    const headerClassName = closeInHeader
        ? 'min-h-9 flex-row items-center justify-between gap-2'
        : undefined;
    const headerCloseClassName = `static shrink-0 ${closeClassName}`;
    const titleClassName = headerContent ? 'sr-only' : headingClassName;

    const onKeyDownCapture = (event: KeyboardEvent<HTMLElement>) => {
        // ⌘/Ctrl+Enter saves, wherever the focus is (also in a field popover).
        if (
            isOpen &&
            (submitFormId || onSubmitShortcut) &&
            event.key === 'Enter' &&
            (event.metaKey || event.ctrlKey) &&
            !event.nativeEvent.isComposing
        ) {
            if (onSubmitShortcut) {
                event.preventDefault();
                event.stopPropagation();
                onSubmitShortcut();

                return;
            }

            const form = document.getElementById(submitFormId ?? '');

            if (form instanceof HTMLFormElement) {
                event.preventDefault();
                event.stopPropagation();
                form.requestSubmit();
            }

            return;
        }

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
                        {!closeInHeader && (
                            <Modal.CloseTrigger className={closeClassName} />
                        )}
                        {wrapContent(
                            <>
                                <Modal.Header className={headerClassName}>
                                    <Modal.Heading className={titleClassName}>
                                        {title}
                                    </Modal.Heading>
                                    {headerContent}
                                    {closeInHeader && (
                                        <Modal.CloseTrigger
                                            className={headerCloseClassName}
                                            aria-label={t('Close')}
                                        />
                                    )}
                                </Modal.Header>
                                <Modal.Body>{children}</Modal.Body>
                                {footer && (
                                    <Modal.Footer>{footer}</Modal.Footer>
                                )}
                            </>,
                        )}
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
                    {wrapContent(
                        <>
                            <Drawer.Header className={headerClassName}>
                                <Drawer.Heading className={titleClassName}>
                                    {title}
                                </Drawer.Heading>
                                {headerContent}
                                {closeInHeader && (
                                    <Drawer.CloseTrigger
                                        className={headerCloseClassName}
                                        aria-label={t('Close')}
                                    />
                                )}
                            </Drawer.Header>
                            <Drawer.Body className="overflow-y-auto">
                                {children}
                            </Drawer.Body>
                            {footer && <Drawer.Footer>{footer}</Drawer.Footer>}
                        </>,
                    )}
                </Drawer.Dialog>
            </Drawer.Content>
        </Drawer.Backdrop>
    );
}
