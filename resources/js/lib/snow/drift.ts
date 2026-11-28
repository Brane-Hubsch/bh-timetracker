import { noise } from './wind';

/**
 * The snow that has settled along the bottom of the screen: a row of narrow columns with a depth each.
 * Falling and thrown snow adds to them, steep sides slide like loose snow and the wind moves snow from
 * exposed crests into the lee.
 */
export const COLUMN_WIDTH = 3;
export const MAX_DEPTH = 46;
/** Largest height difference between neighbouring columns before snow slides down (about 32°). */
const MAX_SLOPE = 1.9;
/** The wind only moves snow above this speed. */
const DRIFTING_WIND = 55;

export class Drift {
    depths = new Float32Array(0);
    /** Average depth, updated by `settle`. */
    mean = 0;

    /** Returns true when the number of columns changed. */
    resize(width: number): boolean {
        const count = Math.ceil(width / COLUMN_WIDTH) + 2;
        if (count === this.depths.length) {
            return false;
        }
        const previous = this.depths;
        this.depths = new Float32Array(count);
        const seed = Math.random() * 100;
        for (let column = 0; column < count; column++) {
            if (previous.length > 0) {
                const source = Math.floor((column / count) * previous.length);
                this.depths[column] = previous[source];
            } else {
                // It has been snowing for a while: start with low, wind-shaped dunes.
                const x = column * COLUMN_WIDTH;
                this.depths[column] =
                    11 +
                    14 * noise(x * 0.004, seed) +
                    5 * noise(x * 0.019, seed + 9);
            }
        }

        return true;
    }

    column(x: number): number {
        return Math.max(
            0,
            Math.min(this.depths.length - 1, Math.round(x / COLUMN_WIDTH)),
        );
    }

    /** Depth of the snow at an x position. */
    depthAt(x: number): number {
        const position = x / COLUMN_WIDTH;
        const column = Math.floor(position);
        if (column < 0 || column >= this.depths.length - 1) {
            return this.depths[this.column(x)] ?? 0;
        }
        const fraction = position - column;

        return (
            this.depths[column] +
            (this.depths[column + 1] - this.depths[column]) * fraction
        );
    }

    add(column: number, amount: number): void {
        if (column < 0 || column >= this.depths.length) {
            return;
        }
        this.depths[column] = Math.min(MAX_DEPTH, this.depths[column] + amount);
    }

    /** Spread an amount of snow (in square pixels) around an x position. */
    deposit(x: number, amount: number, spread = 3): void {
        const centre = this.column(x);
        const share = amount / COLUMN_WIDTH / (spread + 1);
        for (let offset = -spread; offset <= spread; offset++) {
            this.add(
                centre + offset,
                share * (1 - Math.abs(offset) / (spread + 1)),
            );
        }
    }

    /** Lower a column to `level` and return the snow that was removed, in square pixels. */
    cut(column: number, level: number): number {
        const depth = this.depths[column];
        if (!(depth > level)) {
            return 0;
        }
        this.depths[column] = level;

        return (depth - level) * COLUMN_WIDTH;
    }

    /** Let steep sides slide, so cut paths stay open but nothing stands like a wall. */
    settle(): void {
        const depths = this.depths;
        const last = depths.length - 1;
        let total = 0;
        for (let pass = 0; pass < 2; pass++) {
            for (let index = 0; index < last; index++) {
                const column = pass === 0 ? index : last - 1 - index;
                const difference = depths[column] - depths[column + 1];
                if (difference > MAX_SLOPE) {
                    const moved = (difference - MAX_SLOPE) / 2;
                    depths[column] -= moved;
                    depths[column + 1] += moved;
                } else if (difference < -MAX_SLOPE) {
                    const moved = (-difference - MAX_SLOPE) / 2;
                    depths[column] += moved;
                    depths[column + 1] -= moved;
                }
            }
        }
        // Loose snow evens out a little, which rounds off the marks of single flakes.
        let previous = depths[0];
        for (let column = 1; column < last; column++) {
            const depth = depths[column];
            depths[column] +=
                0.012 * (previous + depths[column + 1] - 2 * depth);
            previous = depth;
        }
        for (let column = 0; column <= last; column++) {
            total += depths[column];
        }
        this.mean = total / Math.max(1, depths.length);
    }

    /**
     * Drifting snow: wind above a threshold lifts snow from exposed columns, carries it along and drops
     * it within the next few columns. `lifted` is called where enough snow leaves the surface to be seen.
     */
    blowAway(
        dt: number,
        windAt: (x: number) => number,
        lifted: (x: number, wind: number, amount: number) => void,
    ): void {
        const depths = this.depths;
        const count = depths.length;
        let wind = 0;
        let carried = 0;
        const blowsRight = windAt((count * COLUMN_WIDTH) / 2) >= 0;

        for (let index = 0; index < count; index++) {
            const column = blowsRight ? index : count - 1 - index;
            // The wind changes slowly along the ground, so every eighth column is enough.
            if (index % 8 === 0) {
                wind = windAt(column * COLUMN_WIDTH);
            }
            const upwind = depths[column + (blowsRight ? -1 : 1)] ?? 0;
            const excess = Math.abs(wind) - DRIFTING_WIND;
            let taken = 0;
            if (excess > 0 && depths[column] > 2) {
                // Crests stick up into the wind; the lee behind them is sheltered.
                const exposure = Math.max(
                    0.15,
                    Math.min(3, 1 + 0.7 * (depths[column] - upwind)),
                );
                taken = Math.min(
                    depths[column] - 2,
                    excess * 0.0011 * exposure * dt,
                );
                depths[column] -= taken;
                if (taken > 0.0009) {
                    lifted(column * COLUMN_WIDTH, wind, taken);
                }
            }
            const dropped = carried * 0.07;
            carried += taken - dropped;
            depths[column] = Math.min(MAX_DEPTH, depths[column] + dropped);
        }
    }
}
