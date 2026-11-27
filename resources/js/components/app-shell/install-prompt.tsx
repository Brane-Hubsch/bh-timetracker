import { Button, Drawer } from '@heroui/react';
import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useId, useState } from 'react';
import { BottomSheetBackdrop } from '@/components/bottom-sheet-backdrop';
import { useTranslation } from '@/lib/i18n';
import installIconFace from '@/assets/install-icon-face.svg';
import installIconHand from '@/assets/install-icon-hand.svg';

const storageKey = 'pwa-install-prompt-next-at';
const reminderDelay = 30 * 24 * 60 * 60 * 1000;
let nextPromptInThisTab = 0;

function deferReminder() {
    nextPromptInThisTab = Date.now() + reminderDelay;

    try {
        localStorage.setItem(storageKey, String(nextPromptInThisTab));
    } catch {
        // The tab still remembers the date when the browser blocks storage.
    }
}

function nextPromptAt() {
    try {
        return Math.max(
            nextPromptInThisTab,
            Number(localStorage.getItem(storageKey)) || 0,
        );
    } catch {
        return nextPromptInThisTab;
    }
}

export function InstallPrompt() {
    const { name } = usePage().props;
    const { t } = useTranslation();
    const descriptionId = useId();
    const [isOpen, setIsOpen] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);

    const dismiss = useCallback(() => {
        deferReminder();
        setIsOpen(false);
    }, []);

    useEffect(() => {
        const { userAgent, maxTouchPoints } = navigator;
        // iPad can report a desktop user agent when requesting a desktop website.
        const isMobile =
            /Android|iPhone|iPad|iPod/i.test(userAgent) ||
            (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
        const isInstalled =
            matchMedia('(display-mode: standalone)').matches ||
            (navigator as Navigator & { standalone?: boolean }).standalone;

        if (!isMobile || isInstalled) {
            return;
        }

        const showIfDue = () => {
            if (
                document.visibilityState === 'visible' &&
                Date.now() >= nextPromptAt()
            ) {
                deferReminder();
                setShowInstructions(false);
                setIsOpen(true);
            }
        };

        const syncReminder = (event: StorageEvent) => {
            if (
                event.key === storageKey &&
                Number(event.newValue) > Date.now()
            ) {
                setIsOpen(false);
            }
        };

        showIfDue();
        document.addEventListener('visibilitychange', showIfDue);
        window.addEventListener('storage', syncReminder);
        window.addEventListener('appinstalled', dismiss);

        return () => {
            document.removeEventListener('visibilitychange', showIfDue);
            window.removeEventListener('storage', syncReminder);
            window.removeEventListener('appinstalled', dismiss);
        };
    }, [dismiss]);

    async function install() {
        const nativePrompt = window.pwaInstallPrompt;

        if (nativePrompt) {
            window.pwaInstallPrompt = undefined;
            setIsInstalling(true);

            try {
                await nativePrompt.prompt();
                dismiss();
                return;
            } catch {
                // If the event is no longer usable, show the browser steps.
            } finally {
                setIsInstalling(false);
            }
        }

        setShowInstructions(true);
    }

    return (
        <BottomSheetBackdrop
            isOpen={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    dismiss();
                }
            }}
            variant="opaque"
        >
            <Drawer.Content placement="bottom">
                <Drawer.Dialog
                    aria-describedby={descriptionId}
                    className="mx-auto max-w-lg bg-surface px-6 pt-2 pb-(--mobile-bottom-inset) text-center max-md:px-6"
                >
                    <Drawer.Handle className="pb-4" />
                    <Drawer.Body className="grid animate-none content-start justify-items-center gap-4 mask-none py-0">
                        <div className="grid w-full justify-items-center gap-3">
                            <div
                                className="relative size-[72px]"
                                aria-hidden="true"
                            >
                                <img
                                    src={installIconFace}
                                    width={72}
                                    height={72}
                                    alt=""
                                />
                                <img
                                    src={installIconHand}
                                    width={72}
                                    height={72}
                                    alt=""
                                    className="absolute inset-0 origin-[50%_57.8125%] motion-safe:animate-install-clock-hand"
                                />
                            </div>
                            <div className="w-full space-y-1">
                                <Drawer.Heading className="text-2xl leading-8 font-semibold wrap-anywhere">
                                    {t('Install :app', { app: name })}
                                </Drawer.Heading>
                                <p id={descriptionId} className="text-base">
                                    {t(
                                        'Open the app directly from your home screen.',
                                    )}
                                </p>
                            </div>
                        </div>
                        {showInstructions && (
                            <p
                                role="status"
                                className="w-full rounded-xl bg-surface-secondary px-3 py-2 text-base text-foreground"
                            >
                                {/Android/i.test(navigator.userAgent)
                                    ? t(
                                          'Open the browser menu and choose Install app or Add to Home screen.',
                                      )
                                    : t(
                                          'Tap Share in your browser and choose Add to Home Screen. Turn on Open as Web App if available.',
                                      )}
                            </p>
                        )}
                    </Drawer.Body>
                    <Drawer.Footer className="mt-4 flex-col max-md:px-0">
                        <Button
                            size="lg"
                            variant="ghost"
                            fullWidth
                            className="min-h-11"
                            onPress={dismiss}
                        >
                            {t('Remind me later')}
                        </Button>
                        <Button
                            size="lg"
                            fullWidth
                            className="min-h-11"
                            isPending={isInstalling}
                            onPress={install}
                        >
                            {t('Add to Home Screen')}
                        </Button>
                    </Drawer.Footer>
                </Drawer.Dialog>
            </Drawer.Content>
        </BottomSheetBackdrop>
    );
}
