import { buildSnowModels } from './models';
import type { FromWorker, SnowBackend, ToWorker } from './protocol';
import type { SnowRenderer } from './renderer';
import { createCanvasRenderer } from './renderer-canvas';
import { createWebGpuRenderer } from './renderer-webgpu';
import { Simulation } from './simulation';

/**
 * The snow runs here, off the main thread: the simulation and the drawing on a canvas the page handed
 * over. The page only sends input (size, theme, pointer, tools) and hears back about the game.
 */
type WorkerScope = {
    onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
    postMessage(message: FromWorker): void;
    requestAnimationFrame?: (callback: (time: number) => void) => number;
    cancelAnimationFrame?: (handle: number) => void;
};

const scope = self as unknown as WorkerScope;
const simulation = new Simulation();
let renderer: SnowRenderer | null = null;
let backend: SnowBackend | null = null;
let running = false;
/** What the page asked for; it may ask before the renderer is ready. */
let wanted = true;
let isDark = false;
let frame = 0;
let last = 0;
let started = 0;
let lastPointerAt = 0;
let lastShovelAt = 0;
/** A running average of the time between frames, to notice a struggling device. */
let pace = 16.7;
let slowFor = 0;
let ratioLimit = 2;
let size = { width: 1, height: 1, ratio: 1 };

const post = (message: FromWorker) => scope.postMessage(message);

const schedule = (callback: (time: number) => void): number =>
    scope.requestAnimationFrame
        ? scope.requestAnimationFrame(callback)
        : (setTimeout(
              () => callback(performance.now()),
              16,
          ) as unknown as number);

const cancel = (handle: number): void => {
    if (scope.cancelAnimationFrame) {
        scope.cancelAnimationFrame(handle);
    } else {
        clearTimeout(handle);
    }
};

function applySize(): void {
    simulation.resize(size.width, size.height);
    renderer?.resize(size.width, size.height, Math.min(size.ratio, ratioLimit));
}

function draw(now: number): void {
    frame = schedule(draw);
    const elapsed = now - last;
    // Displays faster than 60 Hz gain nothing here; skip the extra frames.
    if (elapsed < 12) {
        return;
    }
    last = now;
    const dt = Math.min(elapsed / 1000, 1 / 20);

    // Drop detail rather than frames: first the resolution, then the number of flakes.
    if (elapsed < 200) {
        pace += (elapsed - pace) * 0.05;
        slowFor = pace > 24 ? slowFor + dt : 0;
        if (slowFor > 2) {
            slowFor = 0;
            pace = 16.7;
            if (ratioLimit > 1 && size.ratio > 1) {
                ratioLimit = 1;
                applySize();
            } else {
                simulation.quality = Math.max(0.3, simulation.quality * 0.7);
            }
        }
    }

    simulation.step(dt);
    renderer?.render(simulation, (now - started) / 1000, isDark);
    if (simulation.gameChanged) {
        simulation.gameChanged = false;
        post({ type: 'game', game: simulation.game() });
    }
}

function setRunning(next: boolean): void {
    if (next === running || !renderer) {
        return;
    }
    running = next;
    cancel(frame);
    if (running) {
        last = performance.now();
        frame = schedule(draw);
    }
}

async function start(
    canvas: OffscreenCanvas,
    forceCanvas: boolean,
): Promise<void> {
    const fail = () => {
        setRunning(false);
        renderer?.destroy();
        renderer = null;
        post({ type: 'failed', backend });
    };
    try {
        if (!forceCanvas) {
            renderer = await createWebGpuRenderer(canvas, fail);
            backend = renderer ? 'webgpu' : null;
        }
    } catch {
        // No usable WebGPU; a context was requested, so this canvas cannot be drawn on in 2D any more.
        backend = 'webgpu';
        fail();

        return;
    }
    if (!renderer) {
        renderer = createCanvasRenderer(canvas);
        backend = 'canvas2d';
    }
    if (!renderer) {
        fail();

        return;
    }
    applySize();
    started = performance.now();
    post({ type: 'ready', backend: backend ?? 'canvas2d' });
    setRunning(wanted);
    // The snowman and the tools are built once the snow is falling. Where every triangle is painted
    // by the canvas they get fewer of them.
    renderer.setModels(buildSnowModels(backend === 'webgpu' ? 1 : 0.5));
    post({ type: 'tools' });
}

scope.onmessage = ({ data }) => {
    switch (data.type) {
        case 'init':
            size = {
                width: data.width,
                height: data.height,
                ratio: data.ratio,
            };
            isDark = data.isDark;
            simulation.setInteractive(data.interactive);
            void start(data.canvas, data.forceCanvas);
            break;
        case 'resize':
            size = {
                width: data.width,
                height: data.height,
                ratio: data.ratio,
            };
            applySize();
            break;
        case 'theme':
            isDark = data.isDark;
            break;
        case 'interactive':
            simulation.setInteractive(data.interactive);
            break;
        case 'running':
            wanted = data.running;
            setRunning(wanted);
            break;
        case 'tool':
            simulation.setTool(data.tool);
            break;
        case 'pointer': {
            const now = performance.now();
            simulation.pointer(data.x, data.y, (now - lastPointerAt) / 1000);
            lastPointerAt = now;
            break;
        }
        case 'shovel': {
            const now = performance.now();
            simulation.setShovel(
                data.x,
                data.y,
                data.angle,
                (now - lastShovelAt) / 1000,
            );
            lastShovelAt = now;
            break;
        }
        case 'blower':
            simulation.setBlower(data);
            break;
        case 'rebuild':
            simulation.rebuild();
            break;
    }
};
