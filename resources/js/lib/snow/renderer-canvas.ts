import { COLUMN_WIDTH, MAX_DEPTH } from './drift';
import { SNOWMAN_RADII, snowmanCentres } from './geometry';
import type { SnowRenderer } from './renderer';
import {
    INSTANCE_FLOATS,
    KIND_CLUMP,
    KIND_MIST,
    KIND_SPARKLE,
} from './simulation';
import type { Simulation } from './simulation';

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

    const circle = (x: number, y: number, radius: number) => {
        context.moveTo(x + radius, y);
        context.arc(x, y, radius, 0, Math.PI * 2);
    };

    const drawSnowman = (simulation: Simulation, isDark: boolean) => {
        const { x, growth, dressed, outline } = simulation.snowman;
        const edge = isDark
            ? 'rgba(148, 163, 184, 0.5)'
            : 'rgba(100, 116, 139, 0.6)';

        if (outline > 0.01) {
            const full = snowmanCentres([1, 1, 1]);
            context.save();
            context.setLineDash([5, 4]);
            context.lineWidth = 1.5;
            context.strokeStyle = isDark
                ? `rgba(255, 255, 255, ${0.6 * outline})`
                : `rgba(90, 110, 143, ${0.7 * outline})`;
            for (let ball = 0; ball < 3; ball++) {
                context.beginPath();
                circle(x, height - full[ball], SNOWMAN_RADII[ball]);
                context.stroke();
            }
            context.restore();
        }

        const centres = snowmanCentres(growth);
        for (let ball = 0; ball < 3; ball++) {
            const radius = SNOWMAN_RADII[ball] * growth[ball];
            if (radius < 0.75) {
                continue;
            }
            const y = height - centres[ball];
            const shade = context.createRadialGradient(
                x - radius * 0.4,
                y - radius * 0.45,
                radius * 0.1,
                x,
                y,
                radius,
            );
            shade.addColorStop(0, '#ffffff');
            shade.addColorStop(0.6, '#eaf0f8');
            shade.addColorStop(1, isDark ? '#93a9cf' : '#b3c3de');
            context.fillStyle = shade;
            context.strokeStyle = edge;
            context.lineWidth = 1;
            context.beginPath();
            circle(x, y, radius);
            context.fill();
            context.stroke();
        }
        if (dressed <= 0) {
            return;
        }

        const [, middle, head] = snowmanCentres([1, 1, 1]);
        const headY = height - head;
        const bodyY = height - middle;
        const shown = (from: number, to: number) =>
            Math.max(0, Math.min(1, (dressed - from) / (to - from)));

        context.strokeStyle = isDark ? '#75512f' : '#543823';
        context.lineWidth = 2.2;
        context.lineCap = 'round';
        const reach = shown(0.5, 0.75);
        context.beginPath();
        context.moveTo(x - SNOWMAN_RADII[1] * 0.7, bodyY - 3);
        context.lineTo(
            x - SNOWMAN_RADII[1] * 0.7 - 20 * reach,
            bodyY - 3 - 12 * reach,
        );
        context.moveTo(x + SNOWMAN_RADII[1] * 0.7, bodyY - 3);
        context.lineTo(
            x + SNOWMAN_RADII[1] * 0.7 + 19 * reach,
            bodyY - 3 - 13 * reach,
        );
        context.stroke();

        context.fillStyle = '#17171c';
        context.beginPath();
        const buttons = shown(0.4, 0.6);
        circle(x - 1, bodyY - 8, 1.6 * buttons);
        circle(x - 1.4, bodyY - 1, 1.7 * buttons);
        circle(x - 1, bodyY + 6, 1.6 * buttons);
        const eyes = shown(0, 0.2);
        circle(x - 6.4, headY - 2.8, 1.7 * eyes);
        circle(x + 2.2, headY - 2.8, 1.7 * eyes);
        const smile = shown(0.3, 0.5);
        for (let dot = -2; dot <= 2; dot++) {
            circle(
                x - 2 + dot * 2.5,
                headY + 6.3 - dot * dot * 0.6,
                0.95 * smile,
            );
        }
        context.fill();

        const tied = shown(0.65, 0.85);
        context.fillStyle = '#c7242e';
        context.beginPath();
        context.roundRect(
            x - SNOWMAN_RADII[2] * 0.95 * tied,
            bodyY - SNOWMAN_RADII[1] * 0.8 - 3.2,
            SNOWMAN_RADII[2] * 1.9 * tied,
            6.4 * tied,
            3,
        );
        context.roundRect(
            x + SNOWMAN_RADII[2] * 0.3,
            bodyY - SNOWMAN_RADII[1] * 0.8,
            6 * tied,
            18 * tied,
            2.5,
        );
        context.fill();

        const nose = shown(0.15, 0.4);
        context.fillStyle = '#f08a1c';
        context.beginPath();
        context.moveTo(x - 2.5, headY - 1.6);
        context.lineTo(x - 2.5 - 13.5 * nose, headY + 3.5 * nose);
        context.lineTo(x - 2.5, headY + 3.4 * nose);
        context.closePath();
        context.fill();

        const fitted = shown(0.8, 1);
        if (fitted > 0) {
            context.save();
            context.translate(x + 1.2, headY - SNOWMAN_RADII[2] * 0.7);
            context.rotate(0.15);
            context.scale(fitted, fitted);
            context.fillStyle = isDark ? '#3b3f4a' : '#1c1e25';
            context.beginPath();
            context.roundRect(
                -SNOWMAN_RADII[2],
                -2,
                SNOWMAN_RADII[2] * 2,
                4,
                2,
            );
            context.roundRect(
                -SNOWMAN_RADII[2] * 0.66,
                -17.5,
                SNOWMAN_RADII[2] * 1.32,
                17,
                1.5,
            );
            context.fill();
            context.fillStyle = '#c7242e';
            context.fillRect(
                -SNOWMAN_RADII[2] * 0.66,
                -5.6,
                SNOWMAN_RADII[2] * 1.32,
                3.4,
            );
            context.restore();
        }
    };

    const drawDrift = (simulation: Simulation, isDark: boolean) => {
        const depths = simulation.drift.depths;
        const y = (column: number) => height - depths[column];
        const trace = () => {
            context.lineTo(0, y(0));
            for (let column = 1; column < depths.length; column++) {
                context.quadraticCurveTo(
                    (column - 1) * COLUMN_WIDTH,
                    y(column - 1),
                    (column - 0.5) * COLUMN_WIDTH,
                    (y(column - 1) + y(column)) / 2,
                );
            }
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

        render(simulation, _time, isDark) {
            context.clearRect(0, 0, width, height);
            if (simulation.interactive) {
                drawSnowman(simulation, isDark);
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
                } else if (kind === KIND_MIST) {
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
