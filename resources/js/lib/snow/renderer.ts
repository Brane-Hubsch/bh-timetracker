import type { SnowModels } from './models';
import type { Simulation } from './simulation';

/** Draws one frame of the simulation. `time` is seconds since the snow started. */
export interface SnowRenderer {
    resize(width: number, height: number, ratio: number): void;
    /** The models of the snowman and the tools; until they are set, they are not drawn. */
    setModels(models: SnowModels): void;
    render(simulation: Simulation, time: number, isDark: boolean): void;
    destroy(): void;
}
