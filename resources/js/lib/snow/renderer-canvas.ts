import { COLUMN_WIDTH, MAX_DEPTH } from './drift';
import { SNOWMAN_RADII, snowmanCentres } from './geometry';
import type { ModelPose } from './models';
import { MODEL_VERTEX_BYTES } from './shapes';
import type { SnowModel } from './shapes';
import type { SnowRenderer } from './renderer';
import {
    INSTANCE_FLOATS,
    KIND_CLUMP,
    KIND_MIST,
    KIND_SPARKLE,
    KIND_SPRAY,
} from './simulation';
import type { Simulation } from './simulation';

/** A model unpacked for drawing triangle by triangle. */
type Mesh = {
    triangles: number;
    /** Per vertex: x, y, z as a fraction of the extent. */
    positions: Float32Array;
    parts: Uint8Array;
    /** Per triangle: the normal, then the colour (0 to 1). */
    faces: Float32Array;
    /** Scratch space: projected x, y and depth per vertex, and the drawing order. */
    projected: Float32Array;
    depth: Float32Array;
    order: Uint32Array;
};

function unpack(model: SnowModel): Mesh {
    const view = new DataView(model.data);
    const triangles = model.vertexCount / 3;
    const mesh: Mesh = {
        triangles,
        positions: new Float32Array(model.vertexCount * 3),
        parts: new Uint8Array(model.vertexCount),
        faces: new Float32Array(triangles * 6),
        projected: new Float32Array(model.vertexCount * 3),
        depth: new Float32Array(triangles),
        order: new Uint32Array(triangles),
    };
    for (let vertex = 0; vertex < model.vertexCount; vertex++) {
        const at = vertex * MODEL_VERTEX_BYTES;
        for (let axis = 0; axis < 3; axis++) {
            mesh.positions[vertex * 3 + axis] =
                view.getInt16(at + axis * 2, true) / 32767;
        }
        mesh.parts[vertex] = view.getInt16(at + 6, true);
        const face = Math.floor(vertex / 3) * 6;
        for (let axis = 0; axis < 3; axis++) {
            // The triangle's normal is the sum of its corners'; the colour is the same at all three.
            mesh.faces[face + axis] += view.getInt8(at + 8 + axis) / 127;
            mesh.faces[face + 3 + axis] = view.getUint8(at + 12 + axis) / 255;
        }
    }

    return mesh;
}

/**
 * A plain 2D canvas drawing of the same simulation, for browsers without WebGPU: round flakes, a shaded
 * drift and a simple snowman. Returns null if the canvas has no 2D context either.
 */
export function createCanvasRenderer(
    canvas: OffscreenCanvas,
): SnowRenderer | null {
    const context = canvas.getContext('2d');
    if (!context) {
        return null;
    }
    let width = 1;
    let height = 1;
    let meshes: { snowman: Mesh; shovel: Mesh; blower: Mesh } | null = null;

    /** The snowman and the tools, painted back to front as flat triangles. */
    const drawModel = (mesh: Mesh, pose: ModelPose) => {
        if (!pose.visible) {
            return;
        }
        const { positions, parts, faces, projected, depth, order } = mesh;
        const matrices = pose.matrices;
        for (let vertex = 0; vertex < parts.length; vertex++) {
            const m = parts[vertex] * 16;
            const x = positions[vertex * 3];
            const y = positions[vertex * 3 + 1];
            const z = positions[vertex * 3 + 2];
            for (let axis = 0; axis < 3; axis++) {
                projected[vertex * 3 + axis] =
                    matrices[m + axis] * x +
                    matrices[m + 4 + axis] * y +
                    matrices[m + 8 + axis] * z +
                    matrices[m + 12 + axis];
            }
        }
        for (let triangle = 0; triangle < mesh.triangles; triangle++) {
            order[triangle] = triangle;
            depth[triangle] =
                projected[triangle * 9 + 2] +
                projected[triangle * 9 + 5] +
                projected[triangle * 9 + 8];
        }
        order.sort((a, b) => depth[a] - depth[b]);

        // The same soft step from light to tinted shade as the WebGPU shader.
        for (const triangle of order) {
            const at = triangle * 9;
            const m = parts[triangle * 3] * 16;
            const face = triangle * 6;
            // The normal turned like its part (the matrices only rotate and scale evenly).
            let nx = 0;
            let ny = 0;
            let nz = 0;
            for (let axis = 0; axis < 3; axis++) {
                const normal = faces[face + axis];
                nx += matrices[m + axis * 4] * normal;
                ny += matrices[m + axis * 4 + 1] * normal;
                nz += matrices[m + axis * 4 + 2] * normal;
            }
            const length = Math.hypot(nx, ny, nz) || 1;
            const facing = nz < 0 ? -1 / length : 1 / length;
            const light = (nx * -0.51 + ny * 0.63 + nz * 0.59) * facing;
            const lit = Math.max(0, Math.min(1, (light + 0.45) / 1.4));
            const red = faces[face + 3] * (0.62 + 0.42 * lit) * 255;
            const green = faces[face + 4] * (0.6 + 0.43 * lit) * 255;
            const blue = faces[face + 5] * (0.8 + 0.2 * lit) * 255;
            const color = `rgb(${Math.min(255, red)}, ${Math.min(255, green)}, ${Math.min(255, blue)})`;
            context.fillStyle = color;
            context.strokeStyle = color;
            context.beginPath();
            context.moveTo(pose.x + projected[at], pose.y - projected[at + 1]);
            context.lineTo(
                pose.x + projected[at + 3],
                pose.y - projected[at + 4],
            );
            context.lineTo(
                pose.x + projected[at + 6],
                pose.y - projected[at + 7],
            );
            context.closePath();
            context.fill();
            // A hairline in the same colour closes the seams between neighbouring triangles.
            context.stroke();
        }
    };

    const circle = (x: number, y: number, radius: number) => {
        context.moveTo(x + radius, y);
        context.arc(x, y, radius, 0, Math.PI * 2);
    };

    /** A dashed outline of the finished snowman shows where to throw the snow. */
    const drawOutline = (simulation: Simulation, isDark: boolean) => {
        const { x, outline } = simulation.snowman;
        if (outline <= 0.01) {
            return;
        }
        const full = snowmanCentres([1, 1, 1]);
        context.save();
        context.setLineDash([5, 4]);
        context.lineWidth = 1.5;
        context.strokeStyle = isDark
            ? `rgba(255, 255, 255, ${0.6 * outline})`
            : `rgba(107, 128, 168, ${0.8 * outline})`;
        for (let ball = 0; ball < 3; ball++) {
            context.beginPath();
            circle(x, height - full[ball], SNOWMAN_RADII[ball]);
            context.stroke();
        }
        context.restore();
    };

    const drawDrift = (simulation: Simulation, isDark: boolean) => {
        const depths = simulation.drift.depths;
        const y = (column: number) => height - depths[column];
        // Straight edges between knots a few columns apart, like the faceted drift the shaders draw.
        const trace = () => {
            for (let column = 0; column < depths.length; column += 7) {
                context.lineTo(column * COLUMN_WIDTH, y(column));
            }
            context.lineTo(width, y(depths.length - 1));
        };
        const shade = context.createLinearGradient(
            0,
            height - MAX_DEPTH,
            0,
            height,
        );
        shade.addColorStop(0, isDark ? '#f1f5f9' : '#f3f6fb');
        shade.addColorStop(1, isDark ? '#a9bbd8' : '#c6d3e6');
        context.fillStyle = shade;
        context.beginPath();
        context.moveTo(0, height);
        trace();
        context.lineTo(width, height);
        context.closePath();
        context.fill();

        if (!isDark) {
            context.strokeStyle = 'rgba(100, 116, 139, 0.55)';
            context.lineWidth = 1.5;
            context.beginPath();
            context.moveTo(0, y(0));
            trace();
            context.stroke();
        }
    };

    return {
        resize(newWidth, newHeight, ratio) {
            width = newWidth;
            height = newHeight;
            canvas.width = Math.max(1, Math.round(width * ratio));
            canvas.height = Math.max(1, Math.round(height * ratio));
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
        },

        setModels(models) {
            meshes = {
                snowman: unpack(models.snowman),
                shovel: unpack(models.shovel),
                blower: unpack(models.blower),
            };
        },

        render(simulation, _time, isDark) {
            context.clearRect(0, 0, width, height);
            if (simulation.interactive) {
                drawOutline(simulation, isDark);
                if (meshes) {
                    context.lineWidth = 0.6;
                    context.lineJoin = 'round';
                    drawModel(meshes.snowman, simulation.snowmanPose);
                    drawModel(meshes.blower, simulation.blowerPose);
                    drawModel(meshes.shovel, simulation.shovelPose);
                }
                drawDrift(simulation, isDark);
            }

            const instances = simulation.instances;
            const flake = isDark ? '255, 255, 255' : '100, 116, 139';
            for (let index = 0; index < simulation.instanceCount; index++) {
                const at = index * INSTANCE_FLOATS;
                const kind = instances[at + 6];
                const alpha = instances[at + 3];
                let radius = instances[at + 2] * 0.6;
                if (kind === KIND_CLUMP) {
                    context.fillStyle = isDark ? '#f1f5f9' : '#dfe7f2';
                    radius = instances[at + 2] * 0.8;
                } else if (kind === KIND_MIST || kind === KIND_SPRAY) {
                    context.fillStyle = `rgba(${flake}, ${alpha * 0.4})`;
                } else if (kind === KIND_SPARKLE) {
                    context.fillStyle = `rgba(250, 190, 60, ${alpha})`;
                    radius = instances[at + 2] * 0.3;
                } else {
                    context.fillStyle = `rgba(${flake}, ${alpha * (isDark ? 0.9 : 0.65)})`;
                }
                context.beginPath();
                circle(instances[at], instances[at + 1], radius);
                context.fill();
            }
        },

        destroy() {
            // Nothing to release: the context goes with the canvas.
        },
    };
}
