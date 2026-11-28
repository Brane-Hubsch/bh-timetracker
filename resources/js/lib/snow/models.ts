import { SNOW_BLOWER, SNOW_SHOVEL } from './geometry';

/**
 * The low-poly models of the tools and how they are posed. Both models are public domain (CC0):
 *
 * - Snowblower: "Snowblower" by Dreaming381, https://dreaming381.itch.io/snowblower. Colours were
 *   assigned per material and the chute turned to throw backwards.
 * - Shovel: "shovel01" from "Low Poly Tools" by Squareish Design,
 *   https://opengameart.org/content/low-poly-tools. The spade's blade was widened and given a straight
 *   edge to make it a snow shovel, and it was recoloured.
 *
 * The `.bin` files hold flat-shaded triangles, 16 bytes per vertex: position and part index (4 × int16,
 * positions as a fraction of `extent`), normal (4 × int8) and colour (4 × uint8). Model axes are x
 * forward, y up and z towards the viewer. A pose is one matrix per part (column-major, like WebGPU)
 * that takes model positions to CSS pixels around the sprite's anchor, x right, y up, z towards the viewer.
 */
export const MODEL_VERTEX_BYTES = 16;
export const MODEL_MAX_PARTS = 8;
/** Half the side of the square a posed model is drawn into, in CSS pixels. */
export const SPRITE_HALF = 104;
/** How far towards or away from the viewer a posed model may reach. */
export const SPRITE_DEPTH = 220;

export type SnowModel = {
    data: ArrayBuffer;
    vertexCount: number;
    /** The largest coordinate; positions are stored as a fraction of it. */
    extent: number;
};

export type SnowModels = { shovel: SnowModel; blower: SnowModel };

/** A posed model: where its sprite is centred on the page, and a matrix for each part. */
export type ToolPose = {
    visible: boolean;
    x: number;
    y: number;
    matrices: Float32Array;
};

const BLOWER_EXTENT = 1.0618;
const SHOVEL_EXTENT = 1.4023;
// Parts of the snowblower, in the order they are stored.
const BODY = 0;
const CRANK = 1;
const CHUTE = 2;
const AUGER = 3;
const LEFT_WHEEL = 4;
const RIGHT_WHEEL = 5;
const CHUTE_BASE = [0.204, 0.315];
const CHUTE_TIP = [-0.047, 0.774];
/** The angle above the horizon the chute has as modelled. */
const CHUTE_ELEVATION = Math.atan2(
    CHUTE_TIP[1] - CHUTE_BASE[1],
    CHUTE_BASE[0] - CHUTE_TIP[0],
);
const AUGER_CENTRE = [0.574, 0.15];
const WHEEL_RADIUS = 0.125;
const SHOVEL_GRIP = [0, 1.393, 0.035];
const SHOVEL_EDGE = 0.073;
/** How far the tools are turned towards the viewer, and how much they are seen from above. */
const BLOWER_YAW = 0.5;
const BLOWER_PITCH = 0.22;

export function createPose(): ToolPose {
    return {
        visible: false,
        x: 0,
        y: 0,
        matrices: new Float32Array(MODEL_MAX_PARTS * 16),
    };
}

async function load(url: URL, extent: number): Promise<SnowModel> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Snow model ${response.status}`);
    }
    const data = await response.arrayBuffer();

    return { data, vertexCount: data.byteLength / MODEL_VERTEX_BYTES, extent };
}

export async function loadSnowModels(): Promise<SnowModels> {
    const [shovel, blower] = await Promise.all([
        load(new URL('./models/shovel.bin', import.meta.url), SHOVEL_EXTENT),
        load(
            new URL('./models/snowblower.bin', import.meta.url),
            BLOWER_EXTENT,
        ),
    ]);

    return { shovel, blower };
}

type Matrix = Float32Array;

function multiply(a: Matrix, b: Matrix): Matrix {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 4; row++) {
            out[column * 4 + row] =
                a[row] * b[column * 4] +
                a[4 + row] * b[column * 4 + 1] +
                a[8 + row] * b[column * 4 + 2] +
                a[12 + row] * b[column * 4 + 3];
        }
    }

    return out;
}

function chain(...matrices: Matrix[]): Matrix {
    return matrices.reduce(multiply);
}

function move(x: number, y: number, z = 0): Matrix {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}

function scale(factor: number): Matrix {
    return new Float32Array([
        factor,
        0,
        0,
        0,
        0,
        factor,
        0,
        0,
        0,
        0,
        factor,
        0,
        0,
        0,
        0,
        1,
    ]);
}

/** Tilt towards the viewer: seen a little from above. */
function pitch(angle: number): Matrix {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

/** Turn around the vertical axis. */
function yaw(angle: number): Matrix {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

/** Turn in the plane of the screen, anticlockwise. */
function roll(angle: number): Matrix {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function rollAround(x: number, y: number, angle: number): Matrix {
    return chain(move(x, y), roll(angle), move(-x, -y));
}

export type BlowerPosture = {
    /** Left edge on the page and the ground under it. */
    x: number;
    ground: number;
    /** Around the vertical axis: `blowerYaw(1)` faces right, `blowerYaw(-1)` left. */
    yaw: number;
    elevation: number;
    wheel: number;
    auger: number;
    /** The running engine lifts it a fraction of a pixel. */
    shake: number;
};

export function blowerYaw(direction: 1 | -1): number {
    return direction === 1 ? BLOWER_YAW : Math.PI - BLOWER_YAW;
}

/** Poses the snowblower and returns where the snow leaves the chute, on the page. */
export function poseBlower(
    pose: ToolPose,
    posture: BlowerPosture,
): { x: number; y: number } {
    // The sprite is centred a little above the middle of the machine.
    const lift = 52;
    pose.visible = true;
    pose.x = posture.x + SNOW_BLOWER.width / 2;
    pose.y = posture.ground - lift;
    const root = chain(
        move(0, posture.shake - lift),
        pitch(BLOWER_PITCH),
        yaw(posture.yaw),
        scale(SNOW_BLOWER.scale),
    );
    const size = scale(BLOWER_EXTENT);
    const chute = multiply(
        root,
        rollAround(
            CHUTE_BASE[0],
            CHUTE_BASE[1],
            CHUTE_ELEVATION - posture.elevation,
        ),
    );
    const wheel = multiply(root, rollAround(0, WHEEL_RADIUS, -posture.wheel));
    const parts: Matrix[] = [];
    parts[BODY] = root;
    parts[CRANK] = root;
    parts[CHUTE] = chute;
    parts[AUGER] = multiply(
        root,
        rollAround(AUGER_CENTRE[0], AUGER_CENTRE[1], -posture.auger),
    );
    parts[LEFT_WHEEL] = wheel;
    parts[RIGHT_WHEEL] = wheel;
    parts.forEach((part, index) =>
        pose.matrices.set(multiply(part, size), index * 16),
    );

    return {
        x:
            pose.x +
            chute[0] * CHUTE_TIP[0] +
            chute[4] * CHUTE_TIP[1] +
            chute[12],
        y:
            pose.y -
            (chute[1] * CHUTE_TIP[0] + chute[5] * CHUTE_TIP[1] + chute[13]),
    };
}

/** How fast the wheels turn (radians per second) at a speed along the ground. */
export function wheelSpin(speed: number): number {
    return speed / (WHEEL_RADIUS * SNOW_BLOWER.scale);
}

/**
 * Poses the shovel hanging from its grip at (x, y) on the page. `angle` swings it in the plane of the
 * screen (clockwise, 0 hangs straight down).
 */
export function poseShovel(
    pose: ToolPose,
    x: number,
    y: number,
    angle: number,
): void {
    const size = SNOW_SHOVEL.length / (SHOVEL_GRIP[1] - SHOVEL_EDGE);
    pose.visible = true;
    pose.x = x;
    pose.y = y;
    pose.matrices.set(
        chain(
            roll(-angle),
            pitch(0.16),
            // Turned a little, and a little more as it swings.
            yaw(0.5 + angle * 0.5),
            scale(size),
            move(-SHOVEL_GRIP[0], -SHOVEL_GRIP[1], -SHOVEL_GRIP[2]),
            scale(SHOVEL_EXTENT),
        ),
    );
}
