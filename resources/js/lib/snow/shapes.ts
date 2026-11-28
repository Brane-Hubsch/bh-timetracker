/**
 * Builds the low-poly meshes of the snowman and the tools: a few flat faces each, from faceted balls,
 * bevelled boxes and many-sided rods.
 *
 * A mesh is plain triangles, 16 bytes per vertex: position and part index (4 × int16, positions as a
 * fraction of `MODEL_EXTENT`), the face's normal (4 × int8) and colour with the material in alpha
 * (4 × uint8).
 */
export const MODEL_VERTEX_BYTES = 16;
/** Positions are stored as a fraction of this; no shape may reach further from the origin. */
export const MODEL_EXTENT = 128;

/** Materials, stored in the colour's alpha. */
export const MATTE = 255;
/** Shiny, with a glint on the faces that catch the light: eyes and painted plastic. */
export const GLOSSY = 128;
/** Packed snow: blue in the shade. */
export const SNOW = 0;

export type Point = readonly [number, number, number];

export type SnowModel = { data: ArrayBuffer; vertexCount: number };

function normalize([x, y, z]: Point): Point {
    const length = Math.hypot(x, y, z) || 1;

    return [x / length, y / length, z / length];
}

function cross(a: Point, b: Point): Point {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}

/** A steady pseudo-random number between -1 and 1 for a direction. */
function wobble([x, y, z]: Point): number {
    const value = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;

    return (value - Math.floor(value)) * 2 - 1;
}

/** The corners and faces of an icosahedron, each face split into four `level` times. */
function icosphere(level: number): Point[][] {
    const t = (1 + Math.sqrt(5)) / 2;
    const corners = (
        [
            [-1, t, 0],
            [1, t, 0],
            [-1, -t, 0],
            [1, -t, 0],
            [0, -1, t],
            [0, 1, t],
            [0, -1, -t],
            [0, 1, -t],
            [t, 0, -1],
            [t, 0, 1],
            [-t, 0, -1],
            [-t, 0, 1],
        ] as Point[]
    ).map(normalize);
    let faces = [
        [0, 11, 5],
        [0, 5, 1],
        [0, 1, 7],
        [0, 7, 10],
        [0, 10, 11],
        [1, 5, 9],
        [5, 11, 4],
        [11, 10, 2],
        [10, 7, 6],
        [7, 1, 8],
        [3, 9, 4],
        [3, 4, 2],
        [3, 2, 6],
        [3, 6, 8],
        [3, 8, 9],
        [4, 9, 5],
        [2, 4, 11],
        [6, 2, 10],
        [8, 6, 7],
        [9, 8, 1],
    ].map((face) => face.map((corner) => corners[corner]));
    const middle = (a: Point, b: Point) =>
        normalize([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
    for (let split = 0; split < level; split++) {
        faces = faces.flatMap(([a, b, c]) => {
            const ab = middle(a, b);
            const bc = middle(b, c);
            const ca = middle(c, a);

            return [
                [a, ab, ca],
                [b, bc, ab],
                [c, ca, bc],
                [ab, bc, ca],
            ];
        });
    }

    return faces;
}

export class MeshBuilder {
    /** Which part of the model the next shapes belong to; parts are posed separately. */
    part = 0;
    private readonly bytes: number[] = [];
    private readonly view = new DataView(new ArrayBuffer(MODEL_VERTEX_BYTES));

    /**
     * A faceted ball: 20 faces at level 0, 80 at level 1. `lumpy` pushes the corners in and out a
     * little, as if shaped by hand.
     */
    ball(
        centre: Point,
        radii: Point | number,
        color: number,
        material = MATTE,
        level = 1,
        lumpy = 0,
    ): this {
        const [rx, ry, rz] =
            typeof radii === 'number' ? [radii, radii, radii] : radii;
        for (const face of icosphere(level)) {
            const [a, b, c] = face.map((direction): Point => {
                const reach = 1 + lumpy * wobble(direction);

                return [
                    centre[0] + direction[0] * rx * reach,
                    centre[1] + direction[1] * ry * reach,
                    centre[2] + direction[2] * rz * reach,
                ];
            });
            this.triangle(a, b, c, color, material);
        }

        return this;
    }

    /** A box with its edges and corners cut off; `half` is half its size along each axis. */
    box(
        centre: Point,
        half: Point,
        bevel: number,
        color: number,
        material = MATTE,
    ): this {
        // A coarse sphere of directions, pushed out to the corners: its 45° rows become the bevels.
        const grid: Point[] = [];
        for (let ring = 0; ring <= 4; ring++) {
            const tilt = (ring / 4) * Math.PI;
            for (let step = 0; step <= 8; step++) {
                const turn = (step / 8) * Math.PI * 2;
                const direction: Point = [
                    Math.sin(tilt) * Math.cos(turn),
                    Math.cos(tilt),
                    Math.sin(tilt) * Math.sin(turn),
                ];
                grid.push(
                    direction.map(
                        (along, axis) =>
                            centre[axis] +
                            Math.sign(Math.round(along * 1e6)) *
                                (half[axis] - bevel) +
                            along * bevel,
                    ) as unknown as Point,
                );
            }
        }
        for (let ring = 0; ring < 4; ring++) {
            for (let step = 0; step < 8; step++) {
                const a = grid[ring * 9 + step];
                const b = grid[ring * 9 + step + 1];
                const c = grid[(ring + 1) * 9 + step];
                const d = grid[(ring + 1) * 9 + step + 1];
                if (ring > 0) {
                    this.triangle(a, b, c, color, material);
                }
                if (ring < 3) {
                    this.triangle(b, d, c, color, material);
                }
            }
        }

        return this;
    }

    /**
     * A rod with `sides` flat sides from `start` to `end`; the two ends may differ in thickness (a cone
     * when one is close to nothing). `cap` is how far the ends bulge, as a share of the radius.
     */
    rod(
        start: Point,
        end: Point,
        startRadius: number,
        endRadius: number,
        color: number,
        material = MATTE,
        sides = 6,
        cap = 0.3,
    ): this {
        const along = normalize([
            end[0] - start[0],
            end[1] - start[1],
            end[2] - start[2],
        ]);
        // Two directions across the rod.
        const side = normalize(
            cross(along, Math.abs(along[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]),
        );
        const other = cross(along, side);
        const ring = (centre: Point, radius: number, lift: number): Point[] =>
            Array.from({ length: sides + 1 }, (_, step): Point => {
                const turn = (step / sides) * Math.PI * 2;
                const across = Math.cos(turn) * radius;
                const up = Math.sin(turn) * radius;

                return [
                    centre[0] +
                        side[0] * across +
                        other[0] * up +
                        along[0] * lift,
                    centre[1] +
                        side[1] * across +
                        other[1] * up +
                        along[1] * lift,
                    centre[2] +
                        side[2] * across +
                        other[2] * up +
                        along[2] * lift,
                ];
            });
        const from = ring(start, startRadius, 0);
        const to = ring(end, endRadius, 0);
        const [tail] = ring(start, 0, -startRadius * cap);
        const [head] = ring(end, 0, endRadius * cap);
        for (let step = 0; step < sides; step++) {
            this.triangle(
                from[step],
                from[step + 1],
                to[step],
                color,
                material,
            );
            this.triangle(
                from[step + 1],
                to[step + 1],
                to[step],
                color,
                material,
            );
            this.triangle(tail, from[step + 1], from[step], color, material);
            this.triangle(head, to[step], to[step + 1], color, material);
        }

        return this;
    }

    build(): SnowModel {
        const data = new Uint8Array(this.bytes).buffer;

        return { data, vertexCount: data.byteLength / MODEL_VERTEX_BYTES };
    }

    /** One flat face. */
    private triangle(
        a: Point,
        b: Point,
        c: Point,
        color: number,
        material: number,
    ): void {
        const normal = normalize(
            cross(
                [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
                [c[0] - a[0], c[1] - a[1], c[2] - a[2]],
            ),
        );
        // A sliver with no area has no direction to face.
        if (
            !(
                Math.abs(normal[0]) +
                    Math.abs(normal[1]) +
                    Math.abs(normal[2]) >
                0.5
            )
        ) {
            return;
        }
        const view = this.view;
        for (const point of [a, b, c]) {
            for (let axis = 0; axis < 3; axis++) {
                view.setInt16(
                    axis * 2,
                    Math.round((point[axis] / MODEL_EXTENT) * 32767),
                    true,
                );
                view.setInt8(8 + axis, Math.round(normal[axis] * 127));
            }
            view.setInt16(6, this.part, true);
            view.setUint8(12, (color >> 16) & 255);
            view.setUint8(13, (color >> 8) & 255);
            view.setUint8(14, color & 255);
            view.setUint8(15, material);
            for (let byte = 0; byte < MODEL_VERTEX_BYTES; byte++) {
                this.bytes.push(view.getUint8(byte));
            }
        }
    }
}
