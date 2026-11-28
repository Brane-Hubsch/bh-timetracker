import {
    SNOW_BLOWER,
    SNOW_SHOVEL,
    SNOWMAN_RADII,
    snowmanCentres,
} from './geometry';
import { GLOSSY, MATTE, MeshBuilder, MODEL_EXTENT, SNOW } from './shapes';
import type { Point, SnowModel } from './shapes';

/**
 * The snowman, the shovel and the snowblower: small low-poly toys in one soft palette, and how they are
 * posed. Model coordinates are CSS pixels with x forward (to the right), y up and z
 * towards the viewer. A pose is one matrix per part (column-major, like WebGPU) that takes stored
 * positions to pixels around the middle of the model's sprite.
 */
export const MODEL_MAX_PARTS = 12;
/** Half the side of the square a posed model is drawn into, in CSS pixels. */
export const SPRITE_HALF = 104;
/** How far towards or away from the viewer a posed model may reach. */
export const SPRITE_DEPTH = 220;

export type SnowModels = {
    snowman: SnowModel;
    shovel: SnowModel;
    blower: SnowModel;
};

/** A posed model: where its sprite is centred on the page, and a matrix for each part. */
export type ModelPose = {
    visible: boolean;
    x: number;
    y: number;
    matrices: Float32Array;
};

const CORAL = 0xf0736a;
const DEEP_CORAL = 0xd9554f;
const TEAL = 0x4fb3a9;
const DEEP_TEAL = 0x3a958c;
const MUSTARD = 0xf6c95a;
const CREAM = 0xfff1dc;
const PLUM = 0x3d3549;
const INK = 0x2a2433;
const WOOD = 0xc98f5a;
const TWIG = 0x8a5a3a;
const CARROT = 0xf7953a;
const BLUSH = 0xf7a6b4;
const WHITE = 0xffffff;

// The snowman's parts.
const LOW = 0;
const MIDDLE = 1;
const HEAD = 2;
const EYES = 3;
const NOSE = 4;
const SMILE = 5;
const BUTTONS = 6;
const LEFT_ARM = 7;
const RIGHT_ARM = 8;
const SCARF = 9;
const HAT = 10;
const SHOULDER: Point = [17, 4, 0];
const EYE_HEIGHT = 2;

// The snowblower's parts.
const BODY = 0;
const CHUTE = 1;
const AUGER = 2;
const WHEELS = 3;
const LAMPS = 4;
const CHUTE_BASE: Point = [12, 50, 0];
const CHUTE_LENGTH = 30;
const AUGER_CENTRE: Point = [50, 22, 0];
const WHEEL_CENTRE: Point = [-6, 15, 0];
const WHEEL_RADIUS = 15;
const LAMP_CENTRE: Point = [40, 49, 0];
/** How far the snowblower's front is turned towards the viewer, and how much it is seen from above. */
const BLOWER_YAW = 0.45;
const BLOWER_PITCH = 0.2;

export function createPose(): ModelPose {
    return {
        visible: false,
        x: 0,
        y: 0,
        matrices: new Float32Array(MODEL_MAX_PARTS * 16),
    };
}

function buildSnowman(): SnowModel {
    const mesh = new MeshBuilder();
    const [low, middle, head] = SNOWMAN_RADII;
    const onHead = (x: number, y: number, out = 1): Point => [
        x,
        y,
        Math.sqrt(head * head - x * x - y * y) * out,
    ];

    // Each ball is built round the origin and stacked by its pose, so it can grow where it stands.
    mesh.part = LOW;
    mesh.ball([0, 0, 0], [low, low * 0.95, low], WHITE, SNOW, 1, 0.045);
    mesh.part = MIDDLE;
    mesh.ball(
        [0, 0, 0],
        [middle, middle * 0.96, middle],
        WHITE,
        SNOW,
        1,
        0.045,
    );
    mesh.part = HEAD;
    mesh.ball([0, 0, 0], head, WHITE, SNOW, 1, 0.03);

    // Big dark eyes with a glint, and rosy cheeks.
    mesh.part = EYES;
    for (const side of [-1, 1]) {
        mesh.ball(
            onHead(side * 5.8, EYE_HEIGHT, 0.97),
            [2.7, 3.2, 1.8],
            INK,
            GLOSSY,
            1,
        );
        mesh.ball(
            onHead(side * 5.8 - 0.9, EYE_HEIGHT + 1.3, 1.07),
            0.95,
            WHITE,
            MATTE,
            0,
        );
        mesh.ball(
            onHead(side * 10.4, -3.6, 0.97),
            [3.1, 2.2, 1.5],
            BLUSH,
            MATTE,
            0,
        );
    }
    mesh.part = NOSE;
    mesh.rod([0, -1.6, 15], [0, -3.4, 28], 3.4, 0.2, CARROT, MATTE, 5, 0);
    mesh.part = SMILE;
    for (let dot = -2; dot <= 2; dot++) {
        mesh.ball(
            onHead(dot * 2.3, -8.6 + dot * dot * 0.45, 0.99),
            1,
            INK,
            MATTE,
            0,
        );
    }

    mesh.part = BUTTONS;
    mesh.ball([0, 4.5, 19.3], 2, INK, GLOSSY, 0);
    mesh.ball([0, -4.5, 19.3], 2, INK, GLOSSY, 0);

    // Twig arms with mittens.
    for (const [part, side] of [
        [LEFT_ARM, -1],
        [RIGHT_ARM, 1],
    ]) {
        mesh.part = part;
        mesh.rod(
            [side * SHOULDER[0], SHOULDER[1], 0],
            [side * 35, 16, 2],
            1.8,
            1.4,
            TWIG,
            MATTE,
            4,
        );
        mesh.ball([side * 37.5, 17.5, 2], [4.6, 5, 4.2], MUSTARD, MATTE, 0);
    }

    // A scarf round the neck, with the end hanging down the front.
    mesh.part = SCARF;
    mesh.rod([0, 11, 0], [0, 18, 0], 15.8, 14.6, TEAL, MATTE, 8, 0.05);
    mesh.ball([8, 13.5, 15], 3.8, DEEP_TEAL, MATTE, 0);
    mesh.box([8.5, 4.5, 16.2], [3.8, 8.5, 1.9], 0.9, TEAL);

    // A pointed red hat with a white brim and a bobble, its tip flopping to one side.
    mesh.part = HAT;
    mesh.rod([0, 9, 0], [3, 24, 0], 16.2, 8, CORAL, MATTE, 7, 0);
    mesh.rod([3, 24, 0], [10, 35, 0], 8, 2.2, CORAL, MATTE, 7, 0);
    mesh.rod([0, 5.6, 0], [0, 11.4, 0], 18.2, 17.4, CREAM, MATTE, 7, 0.1);
    mesh.ball([12, 37, 0], 4.8, CREAM, MATTE, 0);

    return mesh.build();
}

function buildShovel(): SnowModel {
    const mesh = new MeshBuilder();
    const edge = -SNOW_SHOVEL.length;

    // The grip is at the origin; the shovel hangs down from it.
    mesh.rod([-8, 0, 0], [8, 0, 0], 3.3, 3.3, TEAL, GLOSSY, 6);
    mesh.rod([-7.5, 0, 0], [0, -13, 0], 2.3, 2.3, TEAL, GLOSSY, 5);
    mesh.rod([7.5, 0, 0], [0, -13, 0], 2.3, 2.3, TEAL, GLOSSY, 5);
    mesh.rod([0, -12, 0], [0, edge + 24, 0], 2.7, 2.7, WOOD, MATTE, 6);
    mesh.rod(
        [0, edge + 31, 0.5],
        [0, edge + 21, 1.5],
        4,
        4.4,
        PLUM,
        MATTE,
        6,
        0.1,
    );
    // A plastic scoop with raised sides and a pale wear strip along the edge.
    mesh.box([0, edge + 12, 2.5], [18, 12, 2.4], 1.2, CORAL, GLOSSY);
    for (const side of [-1, 1]) {
        mesh.rod(
            [side * 16.5, edge + 23, 3.5],
            [side * 17.5, edge + 1.5, 5.5],
            3,
            3,
            DEEP_CORAL,
            GLOSSY,
            4,
        );
    }
    mesh.rod(
        [-16.5, edge + 23, 3.5],
        [16.5, edge + 23, 3.5],
        3,
        3,
        DEEP_CORAL,
        GLOSSY,
        4,
    );
    mesh.rod(
        [-16, edge + 0.8, 3.2],
        [16, edge + 0.8, 3.2],
        1.8,
        1.8,
        CREAM,
        MATTE,
        4,
    );

    return mesh.build();
}

function buildBlower(): SnowModel {
    const mesh = new MeshBuilder();

    mesh.part = BODY;
    // A chubby engine with a cream lid, and the housing that swallows the snow.
    mesh.box([-2, 36, 0], [27, 15, 20], 6, CORAL, GLOSSY);
    mesh.box([-2, 28.5, 0], [27.6, 2.6, 20.6], 1.3, CREAM);
    mesh.box([-8, 53, 0], [13, 6, 12], 3.2, CREAM, GLOSSY);
    mesh.ball([-8, 60.5, 0], [4.4, 3.2, 4.4], MUSTARD, GLOSSY, 0);
    mesh.box([34, 25, 0], [20, 22, 30], 7, CORAL, GLOSSY);
    mesh.box([52.5, 22, 0], [3, 15, 24], 1.5, PLUM);
    mesh.rod([-24, 50, -9], [-27.5, 61, -9], 2.8, 3.3, PLUM, MATTE, 5, 0);
    for (const side of [-1, 1]) {
        mesh.rod(
            [-24, 42, side * 14],
            [-50, 74, side * 14],
            2.8,
            2.8,
            PLUM,
            MATTE,
            4,
        );
    }
    mesh.rod([-50, 74, -18], [-50, 74, 18], 4, 4, CREAM, MATTE, 6);

    // The chute is built at the default angle and tilted by its pose.
    mesh.part = CHUTE;
    const lean = SNOW_BLOWER.defaultElevation;
    const along: Point = [-Math.cos(lean), Math.sin(lean), 0];
    const reach = (distance: number): Point => [
        CHUTE_BASE[0] + along[0] * distance,
        CHUTE_BASE[1] + along[1] * distance,
        0,
    ];
    mesh.rod(
        [CHUTE_BASE[0], CHUTE_BASE[1] - 4, 0],
        [CHUTE_BASE[0], CHUTE_BASE[1] + 3, 0],
        10,
        8.5,
        PLUM,
        MATTE,
        6,
        0.1,
    );
    mesh.rod(CHUTE_BASE, reach(CHUTE_LENGTH), 6.4, 8.4, MUSTARD, GLOSSY, 6, 0);
    mesh.rod(
        reach(CHUTE_LENGTH),
        reach(CHUTE_LENGTH + 1),
        6.9,
        6.9,
        PLUM,
        MATTE,
        6,
        0,
    );

    // A cream roller with paddles, so it can be seen to turn.
    mesh.part = AUGER;
    mesh.rod(
        [AUGER_CENTRE[0], AUGER_CENTRE[1], -21],
        [AUGER_CENTRE[0], AUGER_CENTRE[1], 21],
        9.5,
        9.5,
        CREAM,
        MATTE,
        6,
    );
    for (let paddle = 0; paddle < 4; paddle++) {
        const angle = (paddle / 4) * Math.PI * 2;
        mesh.box(
            [
                AUGER_CENTRE[0] + Math.cos(angle) * 8.5,
                AUGER_CENTRE[1] + Math.sin(angle) * 8.5,
                paddle % 2 === 0 ? -10 : 10,
            ],
            [4.2, 4.2, 10.5],
            1.6,
            DEEP_CORAL,
        );
    }

    // Fat ten-sided tyres with six-sided cream hubs.
    mesh.part = WHEELS;
    for (const side of [-1, 1]) {
        mesh.rod(
            [WHEEL_CENTRE[0], WHEEL_CENTRE[1], side * 19],
            [WHEEL_CENTRE[0], WHEEL_CENTRE[1], side * 33],
            WHEEL_RADIUS,
            WHEEL_RADIUS - 1.5,
            PLUM,
            MATTE,
            10,
            0.12,
        );
        mesh.rod(
            [WHEEL_CENTRE[0], WHEEL_CENTRE[1], side * 33],
            [WHEEL_CENTRE[0], WHEEL_CENTRE[1], side * 36.5],
            8,
            6.5,
            CREAM,
            GLOSSY,
            6,
            0.25,
        );
    }

    // Two big headlamps make its face.
    mesh.part = LAMPS;
    for (const side of [-1, 1]) {
        mesh.ball(
            [LAMP_CENTRE[0], LAMP_CENTRE[1], side * 13],
            [8.6, 9.6, 8.6],
            WHITE,
            MATTE,
            1,
        );
        mesh.ball(
            [LAMP_CENTRE[0] + 6.4, LAMP_CENTRE[1] + 1, side * 13],
            [3.8, 5, 4.6],
            INK,
            GLOSSY,
            1,
        );
        mesh.ball(
            [LAMP_CENTRE[0] + 9.2, LAMP_CENTRE[1] + 3.6, side * 13 - 1.6],
            1.5,
            WHITE,
            MATTE,
            0,
        );
    }

    return mesh.build();
}

export function buildSnowModels(): SnowModels {
    return {
        snowman: buildSnowman(),
        shovel: buildShovel(),
        blower: buildBlower(),
    };
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

function stretch(x: number, y = x, z = x): Matrix {
    return new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
}

/** Tilt the top towards the viewer: seen a little from above. */
function pitch(angle: number): Matrix {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

/** Turn around the vertical axis; a positive angle turns what faces the viewer to the right. */
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

function around(point: Point, matrix: Matrix): Matrix {
    return chain(
        move(point[0], point[1], point[2]),
        matrix,
        move(-point[0], -point[1], -point[2]),
    );
}

/** From 0 to 1 with a little overshoot while `amount` passes from `start` to `end`. */
function pop(amount: number, start: number, end: number): number {
    const t = Math.max(0, Math.min(1, (amount - start) / (end - start))) - 1;

    return 1 + 2.70158 * t * t * t + 1.70158 * t * t;
}

function store(pose: ModelPose, parts: Matrix[]): void {
    const size = stretch(MODEL_EXTENT);
    parts.forEach((part, index) =>
        pose.matrices.set(multiply(part, size), index * 16),
    );
}

export type SnowmanPosture = {
    x: number;
    ground: number;
    growth: readonly [number, number, number];
    /** 0 to 1: face, buttons, arms, scarf and hat arrive one after the other. */
    dressed: number;
    lean: number;
    waving: number;
    /** Where it looks, in radians: to the right and downwards are positive. */
    lookAcross: number;
    lookDown: number;
    /** 0 is eyes open, 1 closed. */
    blink: number;
    /** How flattened it is at the moment, e.g. by a lump of snow landing on it. */
    squash: number;
    /** How high it has jumped. */
    hop: number;
    time: number;
};

export function poseSnowman(pose: ModelPose, posture: SnowmanPosture): void {
    const { growth, dressed } = posture;
    const [low, middle, head] = snowmanCentres(growth);
    const lift = 58;
    pose.visible = growth[0] > 0.01;
    pose.x = posture.x;
    pose.y = posture.ground - lift;

    const breath = 1 + 0.014 * Math.sin(posture.time * 2.3);
    const root = chain(
        move(0, posture.hop - lift),
        roll(-posture.lean * 0.012),
        pitch(0.1),
        stretch(
            1 + posture.squash * 0.5,
            (1 - posture.squash) * breath,
            1 + posture.squash * 0.5,
        ),
    );
    const body = chain(root, move(0, middle), stretch(growth[1]));
    const face = chain(
        root,
        move(0, head),
        yaw(posture.lookAcross),
        pitch(posture.lookDown),
        stretch(growth[2]),
    );
    const eyes = pop(dressed, 0, 0.2);
    const reach = pop(dressed, 0.5, 0.75);
    const wave = posture.waving * (0.55 + 0.4 * Math.sin(posture.time * 9));
    const arm = (side: number, lifted: number) =>
        multiply(
            body,
            around(
                [side * SHOULDER[0], SHOULDER[1], 0],
                multiply(roll(side * lifted), stretch(reach)),
            ),
        );

    const parts: Matrix[] = [];
    parts[LOW] = chain(root, move(0, low), stretch(growth[0]));
    parts[MIDDLE] = body;
    parts[HEAD] = face;
    parts[EYES] = multiply(
        face,
        around(
            [0, EYE_HEIGHT, 15],
            stretch(eyes, eyes * (1 - 0.9 * posture.blink), eyes),
        ),
    );
    parts[NOSE] = multiply(
        face,
        around([0, -1.6, 15], stretch(pop(dressed, 0.15, 0.4))),
    );
    parts[SMILE] = multiply(
        face,
        around([0, -8, 14], stretch(pop(dressed, 0.3, 0.5))),
    );
    parts[BUTTONS] = multiply(
        body,
        around([0, 0, 19], stretch(pop(dressed, 0.4, 0.6))),
    );
    parts[LEFT_ARM] = arm(-1, -0.12 * Math.sin(posture.time * 1.7));
    parts[RIGHT_ARM] = arm(1, wave);
    parts[SCARF] = multiply(
        body,
        around([0, 14, 0], stretch(pop(dressed, 0.65, 0.85))),
    );
    parts[HAT] = multiply(
        face,
        around([0, 8, 0], multiply(roll(-0.1), stretch(pop(dressed, 0.8, 1)))),
    );
    store(pose, parts);
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
    /** Leaning back when it sets off and forward when it brakes, in radians. */
    tilt: number;
    /** The running engine makes the body bob: -1 to 1. */
    bob: number;
    blink: number;
};

/**
 * Its front is always turned a little towards the viewer, so it turns round by facing us on the way.
 */
export function blowerYaw(direction: 1 | -1): number {
    return direction === 1 ? -BLOWER_YAW : BLOWER_YAW - Math.PI;
}

/** Poses the snowblower and returns where the snow leaves the chute, on the page. */
export function poseBlower(
    pose: ModelPose,
    posture: BlowerPosture,
): { x: number; y: number } {
    const lift = 46;
    pose.visible = true;
    pose.x = posture.x + SNOW_BLOWER.width / 2;
    pose.y = posture.ground - lift;
    const root = chain(
        move(0, -lift),
        pitch(BLOWER_PITCH),
        yaw(posture.yaw),
        around([WHEEL_CENTRE[0], 0, 0], roll(posture.tilt)),
    );
    const body = multiply(
        root,
        around(
            [0, 12, 0],
            stretch(1 - posture.bob * 0.012, 1 + posture.bob * 0.025, 1),
        ),
    );
    const chute = multiply(
        body,
        around(
            CHUTE_BASE,
            roll(SNOW_BLOWER.defaultElevation - posture.elevation),
        ),
    );
    const parts: Matrix[] = [];
    parts[BODY] = body;
    parts[CHUTE] = chute;
    parts[AUGER] = multiply(body, around(AUGER_CENTRE, roll(-posture.auger)));
    parts[WHEELS] = multiply(root, around(WHEEL_CENTRE, roll(-posture.wheel)));
    parts[LAMPS] = multiply(
        body,
        around(LAMP_CENTRE, stretch(1, 1 - 0.92 * posture.blink, 1)),
    );
    store(pose, parts);

    // The end of the chute as it was built, carried along by the chute's pose.
    const lean = SNOW_BLOWER.defaultElevation;
    const mouthX = CHUTE_BASE[0] - Math.cos(lean) * (CHUTE_LENGTH + 8);
    const mouthY = CHUTE_BASE[1] + Math.sin(lean) * (CHUTE_LENGTH + 8);

    return {
        x: pose.x + chute[0] * mouthX + chute[4] * mouthY + chute[12],
        y: pose.y - (chute[1] * mouthX + chute[5] * mouthY + chute[13]),
    };
}

/** How fast the wheels turn (radians per second) at a speed along the ground. */
export function wheelSpin(speed: number): number {
    return speed / WHEEL_RADIUS;
}

/**
 * Poses the shovel hanging from its grip at (x, y) on the page. `angle` swings it in the plane of the
 * screen (clockwise, 0 hangs straight down).
 */
export function poseShovel(
    pose: ModelPose,
    x: number,
    y: number,
    angle: number,
): void {
    pose.visible = true;
    pose.x = x;
    pose.y = y;
    store(pose, [
        chain(
            roll(-angle),
            pitch(-0.12),
            // Turned a little, and a little more as it swings.
            yaw(0.4 + angle * 0.5),
        ),
    ]);
}
