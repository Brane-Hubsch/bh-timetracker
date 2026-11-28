/**
 * The wind over the page: a slow breeze that turns, gust fronts that travel with it, small eddies and
 * now and then a whirl that carries the snow around. Speeds are CSS pixels per second.
 */
const TURBULENCE = 36;
const MAX_VORTICES = 3;

function hash(x: number, y: number): number {
    let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);

    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise between 0 and 1. */
export function noise(x: number, y: number): number {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const fractionX = x - cellX;
    const fractionY = y - cellY;
    const easeX = fractionX * fractionX * (3 - 2 * fractionX);
    const easeY = fractionY * fractionY * (3 - 2 * fractionY);
    const top =
        hash(cellX, cellY) +
        (hash(cellX + 1, cellY) - hash(cellX, cellY)) * easeX;
    const bottom =
        hash(cellX, cellY + 1) +
        (hash(cellX + 1, cellY + 1) - hash(cellX, cellY + 1)) * easeX;

    return top + (bottom - top) * easeY;
}

export type Vortex = {
    x: number;
    y: number;
    radius: number;
    /** Speed at the edge of the core; the sign is the direction it turns. */
    strength: number;
    age: number;
    life: number;
    /** Whirls at the ground lift snow from the drift. */
    grounded: boolean;
};

export function vortexFade(vortex: Vortex): number {
    return Math.max(
        0,
        Math.min(1, vortex.age / 1.2, (vortex.life - vortex.age) / 1.6),
    );
}

export class Wind {
    readonly vortices: Vortex[] = [];
    /** The wind at the last sampled point. */
    u = 0;
    v = 0;
    private time = Math.random() * 1000;
    private breeze = 0;
    private nextVortexIn = 4 + Math.random() * 4;

    update(dt: number, width: number, height: number): void {
        this.time += dt;
        const time = this.time;
        this.breeze =
            62 * Math.sin(time * 0.093) +
            38 * Math.sin(time * 0.31 + 1.3) +
            12 * Math.sin(time * 1.1 + 0.4);

        for (let index = this.vortices.length - 1; index >= 0; index--) {
            const vortex = this.vortices[index];
            vortex.age += dt;
            vortex.x += this.groundAt(vortex.x) * 0.5 * dt;
            if (
                vortex.age >= vortex.life ||
                vortex.x < -vortex.radius * 2 ||
                vortex.x > width + vortex.radius * 2
            ) {
                this.vortices.splice(index, 1);
            }
        }

        this.nextVortexIn -= dt;
        if (this.nextVortexIn <= 0 && this.vortices.length < MAX_VORTICES) {
            const grounded = Math.random() < 0.6;
            const radius = 34 + Math.random() * 46;
            this.vortices.push({
                x: width * (0.1 + Math.random() * 0.8),
                y: grounded
                    ? height - radius * (0.5 + Math.random() * 0.5)
                    : height * (0.15 + Math.random() * 0.55),
                radius,
                strength:
                    (110 + Math.random() * 120) *
                    (Math.random() < 0.5 ? -1 : 1),
                age: 0,
                life: 5 + Math.random() * 5,
                grounded,
            });
            this.nextVortexIn = 5 + Math.random() * 9;
        }
    }

    /** Between -1 and 1, for things that only lean with the wind. */
    get direction(): number {
        return Math.max(-1, Math.min(1, this.breeze / 90));
    }

    /** The horizontal wind along the ground: the breeze, stronger where a gust passes. */
    groundAt(x: number): number {
        const gust = noise(
            x * 0.0016 - this.time * 0.22 * Math.sign(this.breeze),
            this.time * 0.05,
        );

        return this.breeze * (0.45 + 2 * gust * gust);
    }

    /** Sets `u` and `v` to the wind at a point, with eddies and whirls. */
    sample(x: number, y: number): void {
        let u = this.groundAt(x);
        let v = 0;

        // Divergence-free eddies: the curl of a drifting noise field.
        const noiseX = x * 0.0042 + this.time * 0.06;
        const noiseY = y * 0.0042 - this.time * 0.045;
        const step = 0.35;
        const centre = noise(noiseX, noiseY);
        u += ((noise(noiseX, noiseY + step) - centre) / step) * TURBULENCE;
        v -= ((noise(noiseX + step, noiseY) - centre) / step) * TURBULENCE;

        for (const vortex of this.vortices) {
            const dx = x - vortex.x;
            const dy = y - vortex.y;
            const core = vortex.radius;
            const distance = (dx * dx + dy * dy) / (core * core);
            if (distance > 16) {
                continue;
            }
            const fade = vortexFade(vortex);
            // Fastest at the edge of the core and fading outwards, with a slight pull inwards.
            const spin =
                (vortex.strength * fade * Math.exp(0.5 - 0.5 * distance)) /
                core;
            const pull = Math.abs(spin) * 0.18;
            u += -dy * spin - dx * pull;
            v += dx * spin - dy * pull;
            if (vortex.grounded) {
                v -= 34 * fade * Math.exp(-distance);
            }
        }

        this.u = u;
        this.v = v;
    }
}
