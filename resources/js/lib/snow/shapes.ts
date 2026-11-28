/**
 * Builds the meshes of the snowman and the tools from soft, rounded shapes: balls, rounded boxes and
 * capsules, all with smooth normals so they shade like clay rather than like facets.
 *
 * A mesh is plain triangles, 16 bytes per vertex: position and part index (4 × int16, positions as a
 * fraction of `MODEL_EXTENT`), normal (4 × int8) and colour with the material in alpha (4 × uint8).
 */
export const MODEL_VERTEX_BYTES = 16;
/** Positions are stored as a fraction of this; no shape may reach further from the origin. */
export const MODEL_EXTENT = 128;

/** Materials, stored in the colour's alpha. */
export const MATTE = 255;
/** Shiny, with a highlight: eyes and painted plastic. */
export const GLOSSY = 128;
/** Packed snow: blue in the shade and glittering. */
export const SNOW = 0;

export type Point = readonly [number, number, number];

export type SnowModel = { data: ArrayBuffer; vertexCount: number };

type Vertex = { point: Point; normal: Point };

function normalize([x, y, z]: Point): Point {
    const length = Math.hypot(x, y, z) || 1;

    return [x / length, y / length, z / length];
}

export class MeshBuilder {
    /** Which part of the model the next shapes belong to; parts are posed separately. */
    part = 0;
    private readonly bytes: number[] = [];
    private readonly view = new DataView(new ArrayBuffer(MODEL_VERTEX_BYTES));

    /** `detail` scales the number of triangles: 1 for the GPU, less for the canvas fallback. */
    constructor(private readonly detail: number) {}

    ball(
        centre: Point,
        radii: Point | number,
        color: number,
        material = MATTE,
        segments = 16,
    ): this {
        const [rx, ry, rz] =
            typeof radii === 'number' ? [radii, radii, radii] : radii;

        return this.surface(segments, color, material, ([x, y, z]) => ({
            point: [centre[0] + x * rx, centre[1] + y * ry, centre[2] + z * rz],
            normal: normalize([x / rx, y / ry, z / rz]),
        }));
    }

    /** A box with rounded edges and corners; `half` is half its size along each axis. */
    box(
        centre: Point,
        half: Point,
        radius: number,
        color: number,
        material = MATTE,
        segments = 16,
    ): this {
        return this.surface(segments, color, material, (direction) => ({
            point: [0, 1, 2].map(
                (axis) =>
                    centre[axis] +
                    Math.sign(Math.round(direction[axis] * 1e6)) *
                        (half[axis] - radius) +
                    direction[axis] * radius,
            ) as unknown as Point,
            normal: direction,
        }));
    }

    /** A rod with round ends from `start` to `end`; the two ends may differ in thickness. */
    capsule(
        start: Point,
        end: Point,
        startRadius: number,
        endRadius: number,
        color: number,
        material = MATTE,
        segments = 10,
    ): this {
        const along = normalize([
            end[0] - start[0],
            end[1] - start[1],
            end[2] - start[2],
        ]);
        // Two directions across the rod.
        const helper: Point = Math.abs(along[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        const side = normalize([
            along[1] * helper[2] - along[2] * helper[1],
            along[2] * helper[0] - along[0] * helper[2],
            along[0] * helper[1] - along[1] * helper[0],
        ]);
        const other: Point = [
            along[1] * side[2] - along[2] * side[1],
            along[2] * side[0] - along[0] * side[2],
            along[0] * side[1] - along[1] * side[0],
        ];

        return this.surface(segments, color, material, ([x, y, z]) => {
            const normal: Point = [
                side[0] * x + along[0] * y + other[0] * z,
                side[1] * x + along[1] * y + other[1] * z,
                side[2] * x + along[2] * y + other[2] * z,
            ];
            const from = y > 1e-6 ? end : start;
            const radius = y > 1e-6 ? endRadius : startRadius;

            return {
                point: [
                    from[0] + normal[0] * radius,
                    from[1] + normal[1] * radius,
                    from[2] + normal[2] * radius,
                ],
                normal,
            };
        });
    }

    build(): SnowModel {
        const data = new Uint8Array(this.bytes).buffer;

        return { data, vertexCount: data.byteLength / MODEL_VERTEX_BYTES };
    }

    /** A sphere's grid of directions, shaped by `place` into the surface of something else. */
    private surface(
        segments: number,
        color: number,
        material: number,
        place: (direction: Point) => Vertex,
    ): this {
        // Even numbers, so there is a row of vertices on every plane a box or capsule is split along.
        const around = Math.max(
            8,
            Math.round((segments * this.detail) / 4) * 4,
        );
        const rings = around / 2;
        const grid: Vertex[] = [];
        for (let ring = 0; ring <= rings; ring++) {
            const tilt = (ring / rings) * Math.PI;
            for (let step = 0; step <= around; step++) {
                const turn = (step / around) * Math.PI * 2;
                grid.push(
                    place([
                        Math.sin(tilt) * Math.cos(turn),
                        Math.cos(tilt),
                        Math.sin(tilt) * Math.sin(turn),
                    ]),
                );
            }
        }
        const row = around + 1;
        for (let ring = 0; ring < rings; ring++) {
            for (let step = 0; step < around; step++) {
                const a = grid[ring * row + step];
                const b = grid[ring * row + step + 1];
                const c = grid[(ring + 1) * row + step];
                const d = grid[(ring + 1) * row + step + 1];
                if (ring > 0) {
                    this.triangle(a, b, c, color, material);
                }
                if (ring < rings - 1) {
                    this.triangle(b, d, c, color, material);
                }
            }
        }

        return this;
    }

    private triangle(
        a: Vertex,
        b: Vertex,
        c: Vertex,
        color: number,
        material: number,
    ): void {
        const view = this.view;
        for (const { point, normal } of [a, b, c]) {
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
