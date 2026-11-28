import { COLUMN_WIDTH, Drift } from './drift';
import {
    SNOW_BLOWER,
    SNOW_SHOVEL,
    SNOWMAN_RADII,
    snowmanCentres,
    snowmanGrowth,
} from './geometry';
import {
    blowerYaw,
    createPose,
    poseBlower,
    poseShovel,
    poseSnowman,
    wheelSpin,
} from './models';
import type { BlowerInput, SnowGame, SnowTool } from './protocol';
import { noise, vortexFade, Wind } from './wind';

/**
 * The snow itself, without any drawing: flakes carried by the wind, the drift at the bottom, snow thrown
 * by the shovel and the snowblower, and the snowman that the thrown snow builds. Each step fills
 * `instances` with what the renderer should draw. Units are CSS pixels and seconds.
 */
export const INSTANCE_FLOATS = 8;
export const KIND_FLAKE = 0;
export const KIND_CRYSTAL = 1;
export const KIND_CLUMP = 2;
export const KIND_MIST = 3;
export const KIND_SPARKLE = 4;
/** Fine snow in the snowblower's jet, drawn as soft streaks. */
export const KIND_SPRAY = 5;

const MAX_FLAKES = 900;
const MAX_PARTICLES = 4200;
const GRAVITY = 900;
/** Snow that lands on the drift per flake, relative to its area. */
const SETTLING = 2;
/** Above this average depth, less and less of the falling snow settles. */
const FULL_DRIFT = 34;
/** Slower than this, the shovel pushes the snow ahead of it; faster, it throws it. */
const THROWING_SPEED = 170;
/** Snow the snowblower can throw per second, in square pixels. */
const BLOWER_CAPACITY = 2400;

const PARTICLE_FLOATS = 9;
const P_X = 0;
const P_Y = 1;
const P_VX = 2;
const P_VY = 3;
const P_AMOUNT = 4;
const P_AGE = 5;
const P_LIFE = 6;
const P_KIND = 7;
/** How quickly the air slows it down; light snow hangs and drifts, heavy lumps fly on. */
const P_DRAG = 8;

export type SnowmanLook = {
    x: number;
    growth: [number, number, number];
    /** 0 to 1: eyes, nose, arms, scarf and hat arrive one after the other. */
    dressed: number;
    /** 0 to 1: the outline that shows where to build. */
    outline: number;
    lean: number;
    /** 0 to 1: how eagerly it waves. */
    waving: number;
};

export class Simulation {
    readonly wind = new Wind();
    readonly drift = new Drift();
    readonly instances = new Float32Array(
        (MAX_FLAKES + MAX_PARTICLES) * INSTANCE_FLOATS,
    );
    instanceCount = 0;
    width = 0;
    height = 0;
    /** Lowered by the worker when frames take too long. */
    quality = 1;
    readonly snowman: SnowmanLook = {
        x: 0,
        growth: [0, 0, 0],
        dressed: 0,
        outline: 0,
        lean: 0,
        waving: 0,
    };
    /** Set when the page should hear about the game. */
    gameChanged = false;
    /** The snowman and the tools as the renderer should draw them. */
    readonly snowmanPose = createPose();
    readonly shovelPose = createPose();
    readonly blowerPose = createPose();

    /** Snow settles at the bottom and can be moved (devices with a mouse). */
    interactive = false;
    private time = 0;
    private flakeCount = 0;
    private readonly flakeX = new Float32Array(MAX_FLAKES);
    private readonly flakeY = new Float32Array(MAX_FLAKES);
    private readonly flakeVx = new Float32Array(MAX_FLAKES);
    private readonly flakeVy = new Float32Array(MAX_FLAKES);
    /** 0 is far away (small, slow, faint), 1 is close to the viewer. */
    private readonly flakeDepth = new Float32Array(MAX_FLAKES);
    private readonly flakeRadius = new Float32Array(MAX_FLAKES);
    private readonly flakeFall = new Float32Array(MAX_FLAKES);
    private readonly flakeSway = new Float32Array(MAX_FLAKES);
    private readonly flakePhase = new Float32Array(MAX_FLAKES);
    private readonly flakeSpin = new Float32Array(MAX_FLAKES);
    private readonly flakeTurn = new Float32Array(MAX_FLAKES);
    private readonly flakeFalling = new Uint8Array(MAX_FLAKES);

    private readonly particles = new Float32Array(
        MAX_PARTICLES * PARTICLE_FLOATS,
    );
    private particleCount = 0;

    private tool: SnowTool = null;
    private blower: BlowerInput | null = null;
    private hopper = 0;
    private readonly mouth = { x: 0, y: 0 };
    private blowerTurn = blowerYaw(-1);
    private wheel = 0;
    private blowerLift = 0;
    private blowerSpeed = 0;
    private blowerTilt = 0;
    private tiltSpeed = 0;
    private squash = 0;
    private squashSpeed = 0;
    private lookAcross = -0.3;
    private lookDown = 0;
    private auger = 0;
    private carried: { x: number; y: number; angle: number } | null = null;
    private pointerX = -1000;
    private pointerY = -1000;
    private pointerVx = 0;
    private pointerVy = 0;
    private pointerSeen = false;

    private phase: SnowGame['phase'] = 'waiting';
    private progress = 0;
    private shownProgress = 0;
    private elapsed = 0;
    private leanSpeed = 0;
    private sinceDone = 0;
    private reportIn = 0;

    resize(width: number, height: number): void {
        const first = this.width === 0;
        this.width = width;
        this.height = height;
        this.drift.resize(width);
        // To the right of the middle: clear of the tools parked in the corner.
        this.snowman.x = Math.round(
            Math.max(90, Math.min(width - 250, width * 0.7)),
        );

        const count = Math.min(
            MAX_FLAKES,
            Math.max(90, Math.round((width * height) / 4200)),
        );
        if (count !== this.flakeCount) {
            this.flakeCount = count;
            for (let flake = 0; flake < count; flake++) {
                // Sorted by depth, so near flakes are drawn over far ones.
                this.createFlake(flake, ((flake + 0.5) / count) ** 1.8, true);
                this.flakeFalling[flake] = first || flake % 2 === 0 ? 1 : 0;
            }
        }
    }

    setInteractive(interactive: boolean): void {
        this.interactive = interactive;
        if (!interactive) {
            this.tool = null;
            this.blower = null;
        }
    }

    setTool(tool: SnowTool): void {
        this.tool = this.interactive ? tool : null;
        this.pointerSeen = false;
        this.carried = null;
        if (tool !== 'blower') {
            this.blower = null;
        }
    }

    /**
     * The shovel in the hand: its grip is at (x, y) and it hangs at `angle` (clockwise, 0 is straight
     * down). The edge of its blade digs where it passes through the drift.
     */
    setShovel(x: number, y: number, angle: number, dt: number): void {
        if (this.tool !== 'shovel') {
            return;
        }
        this.carried = { x, y, angle };
        this.pointer(
            x - Math.sin(angle) * SNOW_SHOVEL.length,
            Math.min(this.height - 1, y + Math.cos(angle) * SNOW_SHOVEL.length),
            dt,
        );
    }

    setBlower(blower: BlowerInput): void {
        if (this.tool === 'blower') {
            this.blower = blower;
        }
    }

    game(): SnowGame {
        return {
            phase: this.phase,
            progress: Math.min(1, this.progress),
            elapsedMs: Math.round(this.elapsed * 1000),
        };
    }

    /** The snowman falls apart, and the next one can be built. */
    rebuild(): void {
        if (this.phase === 'waiting' && this.progress === 0) {
            return;
        }
        const centres = snowmanCentres(this.snowman.growth);
        for (let ball = 0; ball < 3; ball++) {
            const radius = SNOWMAN_RADII[ball] * this.snowman.growth[ball];
            for (let piece = 0; piece < radius * 1.6; piece++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.sqrt(Math.random()) * radius;
                this.spawn(
                    KIND_CLUMP,
                    this.snowman.x + Math.cos(angle) * distance,
                    this.height - centres[ball] - Math.sin(angle) * distance,
                    Math.cos(angle) * (40 + Math.random() * 140),
                    -Math.sin(angle) * 120 - Math.random() * 160,
                    4 + Math.random() * 7,
                );
            }
        }
        this.phase = 'waiting';
        this.progress = 0;
        this.shownProgress = 0;
        this.elapsed = 0;
        this.snowman.dressed = 0;
        this.snowman.waving = 0;
        this.gameChanged = true;
    }

    /** The pointer moved (with the shovel in hand: the edge of its blade), stirring the flakes. */
    pointer(x: number, y: number, dt: number): void {
        const elapsed = Math.max(dt, 0.004);
        const seen = this.pointerSeen;
        const fromX = this.pointerX;
        const fromY = this.pointerY;
        this.pointerX = x;
        this.pointerY = y;
        this.pointerSeen = true;
        if (!seen) {
            return;
        }
        const blend = Math.min(1, elapsed * 30);
        this.pointerVx += ((x - fromX) / elapsed - this.pointerVx) * blend;
        this.pointerVy += ((y - fromY) / elapsed - this.pointerVy) * blend;

        if (this.tool === 'shovel') {
            this.shovel(fromX, fromY, x, y);
        }
    }

    step(dt: number): void {
        this.time += dt;
        this.wind.update(dt, this.width, this.height);
        this.pointerVx *= Math.exp(-dt * 5);
        this.pointerVy *= Math.exp(-dt * 5);

        this.instanceCount = 0;
        this.stepFlakes(dt);
        if (this.interactive) {
            this.stepTools(dt);
            this.stepBlower(dt);
            this.stepDrift(dt);
        }
        this.stepParticles(dt);
        this.stepSnowman(dt);
    }

    private createFlake(flake: number, depth: number, anywhere: boolean): void {
        // A few flakes pass right in front of the lens: large and out of focus.
        const close = depth > 0.975;
        this.flakeX[flake] = Math.random() * this.width;
        this.flakeY[flake] = anywhere ? Math.random() * this.height : -24;
        this.flakeDepth[flake] = depth;
        this.flakeRadius[flake] = close
            ? 8 + Math.random() * 7
            : 0.7 + depth * depth * 4.6 + Math.random() * 0.5;
        this.flakeFall[flake] = 24 + depth * 86 + Math.random() * 14;
        this.flakeSway[flake] = 6 + depth * 26 + Math.random() * 12;
        this.flakePhase[flake] = Math.random() * Math.PI * 2;
        this.flakeSpin[flake] = 0.5 + Math.random() * 1.6;
        this.flakeTurn[flake] = Math.random() * Math.PI * 2;
        this.flakeVx[flake] = 0;
        this.flakeVy[flake] = this.flakeFall[flake];
    }

    private stepFlakes(dt: number): void {
        const { wind, drift, instances, width, height } = this;
        // The snowfall thickens and thins over a few minutes.
        const weather = 0.5 + 0.5 * noise(this.time * 0.011, 3.7);
        const falling = Math.round(this.flakeCount * weather * this.quality);
        // It snows harder on bare ground, so a cleared screen is not empty for long.
        const settling =
            SETTLING *
            Math.max(0, Math.min(1, (FULL_DRIFT - drift.mean) / 8)) *
            (1 + 3 * Math.max(0, Math.min(1, (16 - drift.mean) / 10)));
        const wake =
            Math.abs(this.pointerVx) + Math.abs(this.pointerVy) > 60
                ? this.tool === 'shovel'
                    ? 0.7
                    : 0.4
                : 0;

        for (let flake = 0; flake < this.flakeCount; flake++) {
            if (!this.flakeFalling[flake]) {
                if (flake < falling && Math.random() < dt * 0.5) {
                    this.createFlake(flake, this.flakeDepth[flake], false);
                    this.flakeFalling[flake] = 1;
                }
                continue;
            }
            const depth = this.flakeDepth[flake];
            const radius = this.flakeRadius[flake];
            let x = this.flakeX[flake];
            let y = this.flakeY[flake];
            const phase = (this.flakePhase[flake] +=
                this.flakeSpin[flake] * dt);

            wind.sample(x, y);
            // Near flakes cross the screen faster than far ones.
            const follow = 0.35 + 0.65 * depth;
            let targetX =
                wind.u * follow + Math.sin(phase) * this.flakeSway[flake];
            let targetY =
                wind.v * follow +
                this.flakeFall[flake] * (1 + 0.18 * Math.sin(phase * 0.7 + 1));
            if (wake > 0) {
                const dx = x - this.pointerX;
                const dy = y - this.pointerY;
                const distance = dx * dx + dy * dy;
                if (distance < 8100) {
                    const push = wake * (1 - distance / 8100) ** 2;
                    targetX += this.pointerVx * push;
                    targetY += this.pointerVy * push;
                }
            }
            const ease = 1 - Math.exp(-dt * 2.6);
            const vx = (this.flakeVx[flake] +=
                (targetX - this.flakeVx[flake]) * ease);
            const vy = (this.flakeVy[flake] +=
                (targetY - this.flakeVy[flake]) * ease);
            x += vx * dt;
            y += vy * dt;

            const margin = radius * 2 + 4;
            if (x < -margin) {
                x = width + margin;
            } else if (x > width + margin) {
                x = -margin;
            }
            const ground = this.interactive
                ? height - drift.depthAt(x)
                : height + margin;
            if (y >= ground || y < -80) {
                if (this.interactive && y >= ground && radius < 7) {
                    drift.deposit(x, radius * radius * settling);
                }
                if (flake < falling) {
                    this.createFlake(flake, depth, false);
                } else {
                    this.flakeFalling[flake] = 0;
                }
                continue;
            }
            this.flakeX[flake] = x;
            this.flakeY[flake] = y;

            const at = this.instanceCount++ * INSTANCE_FLOATS;
            instances[at] = x;
            instances[at + 1] = y;
            if (radius >= 7) {
                instances[at + 2] = radius;
                instances[at + 3] = 0.2;
                instances[at + 4] = 0;
                instances[at + 5] = 1;
                instances[at + 6] = KIND_FLAKE;
                instances[at + 7] = 1;
            } else if (radius >= 3.1) {
                // Large enough to show the crystal, tumbling as it falls.
                instances[at + 2] = radius * 1.55;
                instances[at + 3] = 0.4 + depth * 0.6;
                instances[at + 4] = this.flakeTurn[flake] + phase * 0.6;
                instances[at + 5] = 0.3 + 0.7 * Math.abs(Math.cos(phase * 0.8));
                instances[at + 6] = KIND_CRYSTAL;
                instances[at + 7] = this.flakeTurn[flake];
            } else {
                instances[at + 2] = radius * 1.7;
                instances[at + 3] = 0.35 + depth * 0.6;
                instances[at + 4] = 0;
                instances[at + 5] = 1;
                instances[at + 6] = KIND_FLAKE;
                instances[at + 7] = 0;
            }
        }
    }

    private stepDrift(dt: number): void {
        const { wind, drift } = this;
        drift.blowAway(
            dt,
            (x) => wind.groundAt(x),
            (x, speed, amount) => {
                if (Math.random() < amount * 30 * this.quality) {
                    this.spawn(
                        KIND_MIST,
                        x,
                        this.height - drift.depthAt(x) - 1,
                        speed * (0.5 + Math.random() * 0.4),
                        -6 - Math.random() * 26,
                        0.5 + Math.random() * 0.5,
                        0.7 + Math.random() * 0.9,
                    );
                }
            },
        );

        // Whirls at the ground pick up loose snow and carry it round.
        for (const vortex of wind.vortices) {
            if (!vortex.grounded || Math.random() > dt * 70 * this.quality) {
                continue;
            }
            const x = vortex.x + (Math.random() - 0.5) * vortex.radius * 2.4;
            const depth = drift.depthAt(x);
            if (depth > 3 && x > 0 && x < this.width) {
                drift.add(drift.column(x), -0.05);
                this.spawn(
                    KIND_MIST,
                    x,
                    this.height - depth,
                    0,
                    -20 - Math.random() * 30,
                    0.7 * vortexFade(vortex),
                    1.6 + Math.random() * 1.6,
                );
            }
        }

        drift.settle();
    }

    private shovel(fromX: number, fromY: number, x: number, y: number): void {
        const { drift, height } = this;
        const reach = SNOW_SHOVEL.reach;
        const speed = Math.hypot(this.pointerVx, this.pointerVy);
        const heading = Math.sign(x - fromX) || Math.sign(this.pointerVx) || 1;
        const first = drift.column(Math.min(fromX, x) - reach);
        const last = drift.column(Math.max(fromX, x) + reach);
        const span = x - fromX;
        let moved = 0;

        for (let column = first; column <= last; column++) {
            const columnX = column * COLUMN_WIDTH;
            // The height of the blade's edge where it passed this column.
            const along =
                span === 0
                    ? 1
                    : Math.max(0, Math.min(1, (columnX - fromX) / span));
            const edge = fromY + (y - fromY) * along;
            const taken = drift.cut(column, Math.max(0, height - edge));
            if (taken <= 0) {
                continue;
            }
            moved += taken;

            if (speed < THROWING_SPEED) {
                // Pushed along in front of the blade, where it piles up.
                drift.deposit(
                    columnX + heading * (reach + 6 + Math.random() * 10),
                    taken,
                    2,
                );
                continue;
            }
            const pieces = Math.ceil(taken / 3);
            const top = height - drift.depths[column];
            for (let piece = 0; piece < pieces; piece++) {
                const power = 0.5 + Math.random() * 0.5;
                this.spawn(
                    KIND_CLUMP,
                    columnX + (Math.random() - 0.5) * 4,
                    Math.min(top, edge) - Math.random() * 6,
                    clampSpeed(this.pointerVx * 0.62 * power, 620) +
                        (Math.random() - 0.5) * 50,
                    clampSpeed(Math.min(this.pointerVy, 0) * 0.55, 500) -
                        (130 + speed * 0.3) * power,
                    taken / pieces,
                );
            }
            if (Math.random() < 0.5) {
                this.spawn(
                    KIND_MIST,
                    columnX,
                    top - 3,
                    this.pointerVx * 0.2,
                    -30 - Math.random() * 40,
                    0.8,
                    0.5 + Math.random() * 0.5,
                );
            }
        }
        if (moved > 0) {
            this.snowMoved();
        }
    }

    /** Where the tools are and how they stand, for the renderer and for the snow they move. */
    private stepTools(dt: number): void {
        const { width, height } = this;
        const parked = SNOW_SHOVEL.parked;
        if (this.carried) {
            poseShovel(
                this.shovelPose,
                this.carried.x,
                this.carried.y,
                this.carried.angle,
            );
        } else {
            // Stuck in the drift, with half the blade showing.
            const x = width - parked.right;
            poseShovel(
                this.shovelPose,
                x,
                height - this.drift.depthAt(x) - parked.above,
                parked.angle,
            );
        }

        const blower = this.blower;
        const direction = blower?.direction ?? -1;
        const speed = blower?.speed ?? 0;
        // It turns round rather than flipping over.
        this.blowerTurn +=
            (blowerYaw(direction) - this.blowerTurn) * (1 - Math.exp(-dt * 9));
        this.wheel += wheelSpin(speed * direction) * dt;
        if (blower) {
            this.auger += dt * 13;
        }
        const x =
            blower?.x ?? width - SNOW_BLOWER.parkedRight - SNOW_BLOWER.width;
        // The wheels stand on the snow under them: on top of the drift when parked, down in the
        // track it has cleared when it drives.
        const under = Math.max(
            0,
            this.drift.depthAt(x + SNOW_BLOWER.width / 2) - 2,
        );
        this.blowerLift += (under - this.blowerLift) * (1 - Math.exp(-dt * 8));
        // It rocks back when it sets off and nods forward when it stops.
        const push =
            (speed * direction - this.blowerSpeed) / Math.max(dt, 0.001);
        this.blowerSpeed = speed * direction;
        this.tiltSpeed +=
            (clampSpeed(push, 900) * 0.0011 -
                this.blowerTilt * 120 -
                this.tiltSpeed * 9) *
            dt;
        this.blowerTilt += this.tiltSpeed * dt;
        const mouth = poseBlower(this.blowerPose, {
            x,
            ground: height - this.blowerLift,
            yaw: this.blowerTurn,
            elevation: blower?.elevation ?? SNOW_BLOWER.defaultElevation,
            wheel: this.wheel,
            auger: this.auger,
            tilt: this.blowerTilt,
            // Putt-putt while the engine runs, a slow doze when parked.
            bob: blower
                ? Math.sin(this.time * 26)
                : 0.4 * Math.sin(this.time * 1.6),
            blink: blinking(this.time, 1.3),
        });
        this.mouth.x = mouth.x;
        this.mouth.y = mouth.y;
    }

    private stepBlower(dt: number): void {
        const blower = this.blower;
        if (!blower) {
            this.hopper = 0;

            return;
        }
        const { drift, mouth } = this;
        const { width, intake } = SNOW_BLOWER;
        const front =
            blower.direction === 1 ? blower.x + width - 4 : blower.x + 4;
        const first = drift.column(
            Math.min(front, front + blower.direction * intake),
        );
        const last = drift.column(
            Math.max(front, front + blower.direction * intake),
        );
        for (let column = first; column <= last; column++) {
            // The auger scrapes almost down to the ground.
            this.hopper += drift.cut(column, 0.6);
        }
        if (this.hopper <= 0.5) {
            return;
        }
        // The impeller's blades send the snow out in quick pulses.
        const pulse = 0.72 + 0.28 * Math.sin(this.time * 80);
        const thrown = Math.min(this.hopper, BLOWER_CAPACITY * dt * pulse);
        this.hopper -= thrown;
        this.snowMoved();

        const jet = 500;
        const backwards = -blower.direction;
        // The snow itself: many small chunks, fastest and densest in the middle of the jet.
        const pieces = Math.max(1, Math.ceil(thrown / 3));
        for (let piece = 0; piece < pieces; piece++) {
            const off = Math.random() + Math.random() + Math.random() - 1.5;
            const angle = blower.elevation + off * 0.13;
            const power =
                jet *
                (1 - Math.abs(off) * 0.22) *
                (0.93 + Math.random() * 0.12);
            const vx = backwards * Math.cos(angle) * power + blower.speed;
            const vy = -Math.sin(angle) * power;
            // Spread along the stream, so it does not come out in bursts.
            const head = Math.random() * dt;
            this.spawn(
                KIND_CLUMP,
                mouth.x + vx * head,
                mouth.y + vy * head,
                vx,
                vy,
                thrown / pieces,
                0,
                0.15 + Math.random() ** 2 * 1.3,
            );
        }
        // Powder torn loose by the air: it leaves with the jet, slows down quickly and hangs as a
        // cloud that drifts with the wind.
        const powder = Math.ceil((thrown / 2.6) * this.quality);
        for (let puff = 0; puff < powder; puff++) {
            const angle = blower.elevation + (Math.random() - 0.5) * 0.34;
            const power = jet * (0.45 + Math.random() * 0.55);
            const head = Math.random() * dt;
            const vx = backwards * Math.cos(angle) * power + blower.speed;
            const vy = -Math.sin(angle) * power;
            this.spawn(
                KIND_SPRAY,
                mouth.x + vx * head,
                mouth.y + vy * head,
                vx,
                vy,
                0.5 + Math.random() * 0.5,
                0.7 + Math.random() * 1.1,
                1.6 + Math.random() * 2.6,
            );
        }
    }

    private spawn(
        kind: number,
        x: number,
        y: number,
        vx: number,
        vy: number,
        amount: number,
        life = 0,
        drag = 0.35,
    ): void {
        if (this.particleCount >= MAX_PARTICLES) {
            return;
        }
        const at = this.particleCount++ * PARTICLE_FLOATS;
        const particles = this.particles;
        particles[at + P_X] = x;
        particles[at + P_Y] = y;
        particles[at + P_VX] = vx;
        particles[at + P_VY] = vy;
        particles[at + P_AMOUNT] = amount;
        particles[at + P_AGE] = 0;
        particles[at + P_LIFE] = life;
        particles[at + P_KIND] = kind;
        particles[at + P_DRAG] = drag;
    }

    private stepParticles(dt: number): void {
        const { particles, instances, wind, drift, width, height } = this;
        const snowman = this.snowman;
        // Thrown snow counts when it falls inside the outline of the finished snowman.
        const outline = snowmanCentres([1, 1, 1]);
        const breeze = wind.direction * 70;

        for (let index = this.particleCount - 1; index >= 0; index--) {
            const at = index * PARTICLE_FLOATS;
            const kind = particles[at + P_KIND];
            let x = particles[at + P_X];
            let y = particles[at + P_Y];
            let vx = particles[at + P_VX];
            let vy = particles[at + P_VY];
            const amount = particles[at + P_AMOUNT];
            const age = (particles[at + P_AGE] += dt);
            const life = particles[at + P_LIFE];
            const drag = particles[at + P_DRAG];
            let gone = false;
            let alpha = 1;
            let size = 1;
            let turn = 0;
            let stretch = 1;

            if (kind === KIND_CLUMP) {
                // Air resistance: towards the speed of the wind, the lighter the lump the sooner.
                const slowed = 1 - Math.exp(-dt * drag);
                vx += (breeze - vx) * slowed;
                vy += GRAVITY * dt - vy * slowed;
                x += vx * dt;
                y += vy * dt;
                size = 1.8 + Math.sqrt(amount) * 1.1;
                // Each chunk tumbles at its own pace.
                turn = age * (5 + drag * 6) + amount * 9;
                const ground =
                    height - (this.interactive ? drift.depthAt(x) : 0);
                let overSnowman = false;
                const dx = x - snowman.x;
                if (dx > -40 && dx < 40) {
                    // Snow that lands at its foot is packed onto it too.
                    overSnowman = y > height - 26 && Math.abs(dx) < 34;
                    for (let ball = 0; ball < 3; ball++) {
                        const dy = height - y - outline[ball];
                        const radius = SNOWMAN_RADII[ball] + 9;
                        overSnowman ||= dx * dx + dy * dy < radius * radius;
                    }
                }
                if (x < -20 || x > width + 20) {
                    gone = true;
                } else if (vy > 0 && overSnowman && this.phase !== 'done') {
                    gone = true;
                    this.pack(amount, vx);
                    if (Math.random() < 0.35) {
                        this.spawn(KIND_MIST, x, y, vx * 0.1, -20, 0.8, 0.5);
                    }
                } else if (vy > 0 && y >= ground) {
                    gone = true;
                    drift.deposit(x, amount, 2);
                    if (Math.random() < 0.3) {
                        this.spawn(
                            KIND_MIST,
                            x,
                            ground - 2,
                            vx * 0.15,
                            -18 - Math.random() * 24,
                            0.7,
                            0.4 + Math.random() * 0.4,
                        );
                    }
                }
            } else if (kind === KIND_SPRAY) {
                wind.sample(x, y);
                const slowed = 1 - Math.exp(-dt * drag);
                vx += (wind.u - vx) * slowed;
                vy += (wind.v + 46 - vy) * slowed + 120 * dt;
                x += vx * dt;
                y += vy * dt;
                const fade = age / life;
                gone =
                    fade >= 1 ||
                    y > height - (this.interactive ? drift.depthAt(x) : 0);
                // Dense and narrow at the chute, thinning into a wide veil.
                alpha =
                    amount * 0.36 * (1 - fade) ** 1.5 * Math.min(1, age * 30);
                size = 2 + fade * 11;
                turn = Math.atan2(vy, vx);
                stretch = 1 + Math.min(3, Math.hypot(vx, vy) * 0.007);
            } else if (kind === KIND_MIST) {
                wind.sample(x, y);
                const ease = 1 - Math.exp(-dt * 3.2);
                vx += (wind.u * 0.9 - vx) * ease;
                vy += (wind.v * 0.9 + 16 - vy) * ease;
                x += vx * dt;
                y += vy * dt;
                const fade = age / life;
                gone = fade >= 1 || y > height;
                alpha = amount * 0.11 * Math.sin(Math.min(1, fade) * Math.PI);
                size = 3 + fade * 7;
            } else {
                vy += 160 * dt;
                vx *= Math.exp(-dt * 1.5);
                x += vx * dt;
                y += vy * dt;
                const fade = age / life;
                gone = fade >= 1;
                alpha =
                    (1 - fade) *
                    (0.55 + 0.45 * Math.sin(age * 22 + amount * 40));
                size = 3 + amount * 4;
            }

            if (gone) {
                const lastAt = --this.particleCount * PARTICLE_FLOATS;
                particles.copyWithin(at, lastAt, lastAt + PARTICLE_FLOATS);
                continue;
            }
            particles[at + P_X] = x;
            particles[at + P_Y] = y;
            particles[at + P_VX] = vx;
            particles[at + P_VY] = vy;

            const to = this.instanceCount++ * INSTANCE_FLOATS;
            instances[to] = x;
            instances[to + 1] = y;
            instances[to + 2] = size;
            instances[to + 3] = alpha;
            instances[to + 4] = kind === KIND_SPARKLE ? age * 2 : turn;
            instances[to + 5] = stretch;
            instances[to + 6] = kind;
            instances[to + 7] = amount;
        }
    }

    /** Thrown snow hit the snowman and becomes part of it. */
    private pack(amount: number, vx: number): void {
        // A wider screen holds more snow, so the snowman asks for more.
        const needed = Math.max(3400, Math.min(5800, this.width * 3.8));
        this.progress += amount / needed;
        this.leanSpeed += clampSpeed(vx, 400) * 0.012;
        this.squashSpeed += Math.min(0.5, amount * 0.09);
        if (this.progress >= 1 && this.phase !== 'done') {
            this.progress = 1;
            this.phase = 'done';
            this.sinceDone = 0;
            this.gameChanged = true;
        }
    }

    private snowMoved(): void {
        if (this.phase === 'waiting') {
            this.phase = 'building';
            this.elapsed = 0;
            this.gameChanged = true;
        }
    }

    private stepSnowman(dt: number): void {
        const snowman = this.snowman;
        if (this.phase === 'building') {
            this.elapsed += dt;
            this.reportIn -= dt;
            if (this.reportIn <= 0) {
                this.reportIn = 0.2;
                this.gameChanged = true;
            }
        }
        this.shownProgress +=
            (Math.min(1, this.progress) - this.shownProgress) *
            (1 - Math.exp(-dt * 7));
        snowman.growth = snowmanGrowth(this.shownProgress);

        const outline =
            this.tool !== null && this.phase !== 'done' && this.interactive
                ? 1
                : 0;
        snowman.outline +=
            (outline - snowman.outline) * (1 - Math.exp(-dt * 5));

        // It sways when it is hit and leans a little with the wind.
        const rest = this.wind.direction * 1.5;
        this.leanSpeed +=
            ((rest - snowman.lean) * 90 - this.leanSpeed * 7) * dt;
        snowman.lean += this.leanSpeed * dt;

        if (this.phase === 'done') {
            const before = this.sinceDone;
            this.sinceDone += dt;
            snowman.dressed = Math.min(1, this.sinceDone / 1.7);
            // Waves when it is finished, and again every now and then.
            const again = (this.sinceDone % 14) / 14;
            snowman.waving =
                this.sinceDone < 5
                    ? Math.min(1, this.sinceDone - 1.2, 5 - this.sinceDone)
                    : Math.max(0, Math.sin(again * Math.PI) ** 12);
            snowman.waving = Math.max(0, snowman.waving);

            if (before < 1.5 && this.sinceDone >= 1.5) {
                this.celebrate();
            }
        }

        // Snow landing on it squashes it for a moment, like something soft.
        this.squashSpeed += (-this.squash * 260 - this.squashSpeed * 13) * dt;
        this.squash = Math.max(
            -0.12,
            Math.min(0.16, this.squash + this.squashSpeed * dt),
        );
        // It follows the pointer with its head, and otherwise looks towards the middle of the page.
        const watching = this.pointerSeen && this.pointerY > -500;
        // The snowblower is the most interesting thing around while it is driven.
        const watchedX = this.blower
            ? this.blower.x + SNOW_BLOWER.width / 2
            : this.pointerX;
        const across =
            watching || this.blower
                ? Math.max(-0.75, Math.min(0.75, (watchedX - snowman.x) / 420))
                : -0.3;
        const down = watching
            ? Math.max(
                  -0.3,
                  Math.min(0.3, (this.pointerY - (this.height - 85)) / 900),
              )
            : 0;
        const turn = 1 - Math.exp(-dt * 5);
        this.lookAcross += (across - this.lookAcross) * turn;
        this.lookDown += (down - this.lookDown) * turn;
        // A happy hop when it is finished.
        const since = this.phase === 'done' ? this.sinceDone - 1.5 : -1;
        const hop =
            since > 0 && since < 0.9
                ? Math.abs(Math.sin(since * Math.PI * 2.2)) *
                  14 *
                  (1 - since / 0.9)
                : 0;
        poseSnowman(this.snowmanPose, {
            x: snowman.x,
            ground: this.height,
            growth: snowman.growth,
            dressed: snowman.dressed,
            lean: snowman.lean,
            waving: snowman.waving,
            lookAcross: this.lookAcross,
            lookDown: this.lookDown,
            blink: blinking(this.time, 0),
            squash: this.squash,
            hop,
            time: this.time,
        });
    }

    private celebrate(): void {
        const centres = snowmanCentres([1, 1, 1]);
        for (let spark = 0; spark < 46; spark++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 190;
            this.spawn(
                KIND_SPARKLE,
                this.snowman.x + (Math.random() - 0.5) * 30,
                this.height - centres[1] - Math.random() * 40,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed - 120,
                Math.random(),
                0.9 + Math.random() * 1.1,
            );
        }
    }
}

/** 0 with open eyes, rising to 1 for a moment every few seconds. */
function blinking(time: number, offset: number): number {
    const phase = (time + offset) % 3.7;

    return phase < 0.14 ? Math.sin((phase / 0.14) * Math.PI) : 0;
}

function clampSpeed(value: number, limit: number): number {
    return Math.max(-limit, Math.min(limit, value));
}
