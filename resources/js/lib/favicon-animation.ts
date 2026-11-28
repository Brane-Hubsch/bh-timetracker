import faceUrl from '@/assets/install-icon-face.svg';
import handUrl from '@/assets/install-icon-hand.svg';

const ICON_SIZE = 32;
const FRAME_COUNT = 24;
const FRAME_INTERVAL_MS = 60;
const SAVE_DURATION_MS = 850;
const TIMER_REVOLUTION_MS = 2400;

async function loadImage(url: string) {
    const image = new Image();
    image.src = url;
    await image.decode();

    return image;
}

async function loadFrameRenderer() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = ICON_SIZE;
    const context = canvas.getContext('2d');

    if (!context) {
        return null;
    }

    const [face, hand] = await Promise.all([
        loadImage(faceUrl),
        loadImage(handUrl),
    ]);
    const frames: string[] = [];
    // The pivot is the bottom of the T's stem in the 72 px artwork.
    const pivotX = ICON_SIZE / 2;
    const pivotY = (41.625 / 72) * ICON_SIZE;

    return (turn: number) => {
        const frame = Math.round(turn * FRAME_COUNT) % FRAME_COUNT;

        if (!frames[frame]) {
            context.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
            context.drawImage(face, 0, 0, ICON_SIZE, ICON_SIZE);
            context.save();
            context.translate(pivotX, pivotY);
            context.rotate((frame / FRAME_COUNT) * Math.PI * 2);
            context.drawImage(hand, -pivotX, -pivotY, ICON_SIZE, ICON_SIZE);
            context.restore();
            frames[frame] = canvas.toDataURL();
        }

        return frames[frame];
    };
}

export function createFaviconAnimation() {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const staticIcons = document.head.querySelectorAll('link[rel="icon"]');
    const animatedIcon = document.createElement('link');
    animatedIcon.rel = 'icon';
    animatedIcon.type = 'image/png';
    animatedIcon.sizes.add(`${ICON_SIZE}x${ICON_SIZE}`);

    const saveEffect = new KeyframeEffect(null, [], {
        duration: SAVE_DURATION_MS,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'both',
    });
    const saveAnimation = new Animation(saveEffect);
    let renderer: ReturnType<typeof loadFrameRenderer> | undefined;
    let timerRunning = false;
    let pendingSaves = 0;
    let timeout: number | undefined;

    const shouldAnimate = () =>
        !motion.matches && (timerRunning || pendingSaves > 0);

    function stop() {
        window.clearTimeout(timeout);
        timeout = undefined;

        if (animatedIcon.isConnected) {
            document.head.append(...staticIcons);
            animatedIcon.remove();
        }
    }

    async function start() {
        if (timeout !== undefined || !shouldAnimate()) {
            return;
        }

        const render = await (renderer ??= loadFrameRenderer().catch(
            () => null,
        ));

        if (!render || timeout !== undefined || !shouldAnimate()) {
            return;
        }

        let startedAt = performance.now();

        const update = () => {
            const now = performance.now();
            let elapsed = now - startedAt;

            if (!timerRunning && elapsed >= SAVE_DURATION_MS) {
                pendingSaves -= 1;

                if (pendingSaves === 0) {
                    stop();
                    return;
                }

                startedAt = now;
                elapsed = 0;
            }

            let turn = (elapsed % TIMER_REVOLUTION_MS) / TIMER_REVOLUTION_MS;

            if (!timerRunning) {
                saveAnimation.currentTime = elapsed;
                turn = saveEffect.getComputedTiming().progress ?? 0;
            }

            const url = render(turn);

            if (animatedIcon.href !== url) {
                animatedIcon.href = url;
            }

            if (!animatedIcon.isConnected) {
                // Browsers can keep choosing the ICO while it is listed as a candidate.
                document.head.append(animatedIcon);
                staticIcons.forEach((icon) => icon.remove());
            }

            timeout = window.setTimeout(
                update,
                timerRunning
                    ? FRAME_INTERVAL_MS
                    : Math.min(FRAME_INTERVAL_MS, SAVE_DURATION_MS - elapsed),
            );
        };

        update();
    }

    motion.addEventListener('change', () => {
        pendingSaves = 0;
        stop();
        void start();
    });

    return {
        setTimerRunning(running: boolean) {
            if (timerRunning !== running) {
                timerRunning = running;
                pendingSaves = 0;
                stop();
                void start();
            }
        },
        playSave() {
            if (!timerRunning && !motion.matches) {
                pendingSaves += 1;
                void start();
            }
        },
    };
}
