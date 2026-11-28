import type { Simulation } from './simulation';

/** Draws one frame of the simulation. `time` is seconds since the snow started. */
export interface SnowRenderer {
    resize(width: number, height: number, ratio: number): void;
    render(simulation: Simulation, time: number, isDark: boolean): void;
    destroy(): void;
}
