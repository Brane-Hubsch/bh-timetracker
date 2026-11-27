import { Button, Card } from '@heroui/react';
import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
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

export function InstallPrompt({ hasTimer }: { hasTimer: boolean }) {
    const { name } = usePage().props;
    const { t } = useTranslation();
    const titleId = useId();
    const [step, setStep] = useState<'hidden' | 'offer' | 'instructions'>(
        'hidden',
    );
    const [isInstalling, setIsInstalling] = useState(false);

    const dismiss = useCallback(() => {
        deferReminder();
        setStep('hidden');
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
                setStep('offer');
            }
        };

        const syncReminder = (event: StorageEvent) => {
            if (
                event.key === storageKey &&
                Number(event.newValue) > Date.now()
            ) {
                setStep('hidden');
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

        setStep('instructions');
    }

    if (step === 'hidden') {
        return null;
    }

    return (
        <Card
            aria-labelledby={titleId}
            className={cn(
                'fixed inset-x-3 bottom-(--install-bottom) z-40 mx-auto max-h-[calc(100dvh-var(--install-bottom)-env(safe-area-inset-top)-0.75rem)] max-w-[24rem] gap-4 overflow-y-auto overscroll-contain rounded-2xl border border-border p-5 text-center shadow-lg md:[--install-bottom:0.75rem]',
                hasTimer
                    ? '[--install-bottom:calc(var(--mobile-tab-bar-height)+var(--mobile-timer-space)+0.75rem)]'
                    : '[--install-bottom:calc(var(--mobile-tab-bar-height)+0.75rem)]',
            )}
        >
            <Card.Header className="shrink-0 items-center gap-3">
                <div
                    className="relative size-[72px] shrink-0"
                    aria-hidden="true"
                >
                    <img src={installIconFace} width={72} height={72} alt="" />
                    <img
                        src={installIconHand}
                        width={72}
                        height={72}
                        alt=""
                        className="absolute inset-0 origin-[50%_57.8125%] motion-safe:animate-install-clock-hand"
                    />
                </div>
                <div className="w-full space-y-1">
                    <Card.Title
                        id={titleId}
                        className="text-2xl leading-8 font-semibold wrap-anywhere"
                    >
                        {t('Install :app', { app: name })}
                    </Card.Title>
                    <Card.Description className="text-base leading-6">
                        {t('Open the app directly from your home screen.')}
                    </Card.Description>
                </div>
            </Card.Header>
            {step === 'instructions' && (
                <p
                    role="status"
                    className="shrink-0 rounded-xl bg-surface-secondary px-3 py-2 text-base"
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
            <Card.Footer className="shrink-0 flex-col gap-2">
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
            </Card.Footer>
        </Card>
    );
}
