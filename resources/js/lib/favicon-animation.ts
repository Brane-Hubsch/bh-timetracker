import faceUrl from '@/assets/install-icon-face.svg';
import handUrl from '@/assets/install-icon-hand.svg';

const ICON_SIZE = 32;
const SAVE_FRAME_COUNT = 10;
// Chromium coalesces tab UI updates over 200 ms. Hold each angle long enough to be painted.
const SAVE_FRAME_INTERVAL_MS = 240;
const TIMER_FRAME_COUNT = 24;
const TIMER_FRAME_INTERVAL_MS = 60;
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
    const frames = new Map<number, string>();
    // The pivot is the bottom of the T's stem in the 72 px artwork.
    const pivotX = ICON_SIZE / 2;
    const pivotY = (41.625 / 72) * ICON_SIZE;

    return (turn: number) => {
        const cached = frames.get(turn);

        if (cached) {
            return cached;
        }

        context.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
        context.drawImage(face, 0, 0, ICON_SIZE, ICON_SIZE);
        context.save();
        context.translate(pivotX, pivotY);
        context.rotate(turn * Math.PI * 2);
        context.drawImage(hand, -pivotX, -pivotY, ICON_SIZE, ICON_SIZE);
        context.restore();

        const url = canvas.toDataURL();
        frames.set(turn, url);

        return url;
    };
}

export function createFaviconAnimation() {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const staticIcons = document.head.querySelectorAll('link[rel="icon"]');
    const animatedIcon = document.createElement('link');
    animatedIcon.rel = 'icon';
    animatedIcon.type = 'image/png';
    animatedIcon.sizes.add(`${ICON_SIZE}x${ICON_SIZE}`);

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

        const startedAt = performance.now();
        let saveFrame = 0;

        const update = () => {
            if (!timerRunning && saveFrame === SAVE_FRAME_COUNT) {
                pendingSaves -= 1;

                if (pendingSaves === 0) {
                    stop();
                    return;
                }

                saveFrame = 0;
            }

            const frameCount = timerRunning
                ? TIMER_FRAME_COUNT
                : SAVE_FRAME_COUNT;
            const frame = timerRunning
                ? Math.round(
                      ((performance.now() - startedAt) / TIMER_REVOLUTION_MS) *
                          frameCount,
                  ) % frameCount
                : saveFrame++;
            const url = render(frame / frameCount);

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
                timerRunning ? TIMER_FRAME_INTERVAL_MS : SAVE_FRAME_INTERVAL_MS,
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
