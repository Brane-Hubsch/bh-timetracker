import type {
    BlowerInput,
    FromWorker,
    SnowBackend,
    SnowGame,
    SnowTool,
    ToWorker,
} from './protocol';

/**
 * The page's side of the snow: owns the canvas and the worker that draws on it. There is one for the
 * whole visit, so the snow (and a half-built snowman) stays when the layout is mounted again; the
 * canvas is simply moved into the new container.
 */
export type SnowStatus = {
    /** Null until the first frame can be drawn. */
    backend: SnowBackend | null;
    /** The shovel and the snowblower are drawn and can be used. */
    hasTools: boolean;
    game: SnowGame;
};

const IDLE_GAME: SnowGame = { phase: 'waiting', progress: 0, elapsedMs: 0 };

function isDark(): boolean {
    return document.documentElement.classList.contains('dark');
}

function viewport(): { width: number; height: number; ratio: number } {
    return {
        width: window.innerWidth,
        height: window.innerHeight,
        ratio: Math.min(window.devicePixelRatio || 1, 2),
    };
}

class SnowHost {
    private canvas: HTMLCanvasElement | null = null;
    private worker: Worker | null = null;
    private status: SnowStatus = {
        backend: null,
        hasTools: false,
        game: IDLE_GAME,
    };
    private readonly listeners = new Set<() => void>();
    private interactive = false;
    private mounted = 0;
    private triedCanvas = false;
    private dead = false;
    private stopWatching: (() => void) | null = null;

    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    };

    readonly getStatus = (): SnowStatus => this.status;

    /** Show the snow in `container`. Returns what to call when the container goes away. */
    mount(container: HTMLElement, interactive: boolean): () => void {
        this.mounted++;
        this.interactive = interactive;
        if (!this.canvas && !this.dead) {
            this.start(false);
        }
        if (this.canvas) {
            container.append(this.canvas);
        }
        this.send({ type: 'interactive', interactive });
        this.watch();
        this.send({ type: 'running', running: !document.hidden });

        return () => {
            this.mounted--;
            // Strict mode and layout changes mount again right away; only pause if nobody did.
            queueMicrotask(() => {
                if (this.mounted === 0) {
                    this.stopWatching?.();
                    this.stopWatching = null;
                    this.canvas?.remove();
                    this.send({ type: 'tool', tool: null });
                    this.send({ type: 'running', running: false });
                }
            });
        };
    }

    setInteractive(interactive: boolean): void {
        this.interactive = interactive;
        this.send({ type: 'interactive', interactive });
    }

    setTool(tool: SnowTool): void {
        this.send({ type: 'tool', tool });
    }

    pointer(x: number, y: number): void {
        this.send({ type: 'pointer', x, y });
    }

    shovel(x: number, y: number, angle: number): void {
        this.send({ type: 'shovel', x, y, angle });
    }

    blower(input: BlowerInput): void {
        this.send({ type: 'blower', ...input });
    }

    rebuild(): void {
        this.send({ type: 'rebuild' });
    }

    private send(message: ToWorker, transfer: Transferable[] = []): void {
        this.worker?.postMessage(message, transfer);
    }

    private update(change: Partial<SnowStatus>): void {
        this.status = { ...this.status, ...change };
        this.listeners.forEach((listener) => listener());
    }

    private start(forceCanvas: boolean): void {
        if (
            typeof Worker === 'undefined' ||
            typeof HTMLCanvasElement.prototype.transferControlToOffscreen !==
                'function'
        ) {
            this.dead = true;

            return;
        }
        const container = this.canvas?.parentElement;
        this.canvas?.remove();
        this.worker?.terminate();

        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.className = 'block size-full';
        const worker = new Worker(new URL('./worker.ts', import.meta.url), {
            type: 'module',
        });
        this.canvas = canvas;
        this.worker = worker;
        container?.append(canvas);

        worker.onmessage = ({ data }: MessageEvent<FromWorker>) => {
            if (worker !== this.worker) {
                return;
            }
            if (data.type === 'ready') {
                this.update({ backend: data.backend });
            } else if (data.type === 'tools') {
                this.update({ hasTools: true });
            } else if (data.type === 'game') {
                this.update({ game: data.game });
            } else {
                this.fail(data.backend === 'webgpu');
            }
        };
        worker.onerror = () => {
            if (worker === this.worker) {
                this.fail(!forceCanvas);
            }
        };

        const offscreen = canvas.transferControlToOffscreen();
        this.send(
            {
                type: 'init',
                canvas: offscreen,
                ...viewport(),
                isDark: isDark(),
                interactive: this.interactive,
                forceCanvas,
            },
            [offscreen],
        );
    }

    /** WebGPU can fail after it looked fine (a lost device, a driver bug): try once more without it. */
    private fail(retryWithCanvas: boolean): void {
        this.update({ backend: null, hasTools: false, game: IDLE_GAME });
        if (retryWithCanvas && !this.triedCanvas) {
            this.triedCanvas = true;
            this.start(true);
            this.send({ type: 'running', running: !document.hidden });

            return;
        }
        this.dead = true;
        this.worker?.terminate();
        this.worker = null;
        this.canvas?.remove();
        this.canvas = null;
    }

    private watch(): void {
        if (this.stopWatching) {
            return;
        }
        const onResize = () => this.send({ type: 'resize', ...viewport() });
        const onVisibility = () =>
            this.send({ type: 'running', running: !document.hidden });
        const theme = new MutationObserver(() =>
            this.send({ type: 'theme', isDark: isDark() }),
        );
        window.addEventListener('resize', onResize);
        document.addEventListener('visibilitychange', onVisibility);
        theme.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });
        onResize();
        this.send({ type: 'theme', isDark: isDark() });

        this.stopWatching = () => {
            window.removeEventListener('resize', onResize);
            document.removeEventListener('visibilitychange', onVisibility);
            theme.disconnect();
        };
    }
}

let host: SnowHost | null = null;

export function snowHost(): SnowHost {
    host ??= new SnowHost();

    return host;
}
