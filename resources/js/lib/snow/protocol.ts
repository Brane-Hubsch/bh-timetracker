/**
 * Messages between the page (`host.ts`) and the snow worker (`worker.ts`). All positions are CSS pixels
 * in the viewport.
 */
export type SnowBackend = 'webgpu' | 'canvas2d';

export type SnowTool = 'shovel' | 'blower' | null;

export type SnowGame = {
    /** `waiting` until the first snow is moved, `done` when the snowman is finished. */
    phase: 'waiting' | 'building' | 'done';
    /** How much of the snowman is built, 0 to 1. */
    progress: number;
    elapsedMs: number;
};

export type BlowerInput = {
    /** Left edge of the snowblower. */
    x: number;
    direction: 1 | -1;
    /** Angle of the chute above the horizon, in radians. */
    elevation: number;
    /** Signed speed in pixels per second. */
    speed: number;
};

export type ToWorker =
    | {
          type: 'init';
          canvas: OffscreenCanvas;
          width: number;
          height: number;
          ratio: number;
          isDark: boolean;
          /** Snow settles and can be moved (devices with a mouse). */
          interactive: boolean;
          /** Use the plain canvas renderer even where WebGPU exists. */
          forceCanvas: boolean;
      }
    | { type: 'resize'; width: number; height: number; ratio: number }
    | { type: 'theme'; isDark: boolean }
    | { type: 'interactive'; interactive: boolean }
    | { type: 'running'; running: boolean }
    | { type: 'tool'; tool: SnowTool }
    | { type: 'pointer'; x: number; y: number }
    /** The shovel in the hand: where its grip is and how it hangs (radians, clockwise). */
    | { type: 'shovel'; x: number; y: number; angle: number }
    | ({ type: 'blower' } & BlowerInput)
    | { type: 'rebuild' };

export type FromWorker =
    | { type: 'ready'; backend: SnowBackend }
    /** The models of the tools are loaded, so the tools can be shown and used. */
    | { type: 'tools' }
    | { type: 'game'; game: SnowGame }
    | { type: 'failed'; backend: SnowBackend | null };
