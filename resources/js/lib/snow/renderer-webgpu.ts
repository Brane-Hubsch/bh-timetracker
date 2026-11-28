import { COLUMN_WIDTH, MAX_DEPTH } from './drift';
import type { SnowRenderer } from './renderer';
import { DRIFT_SHADER, PARTICLE_SHADER, SNOWMAN_SHADER } from './shaders';
import { INSTANCE_FLOATS } from './simulation';
import type { Simulation } from './simulation';

const GLOBALS_FLOATS = 20;
// GPUBufferUsage and GPUTextureUsage flags.
const COPY_DST = 0x08;
const VERTEX = 0x20;
const UNIFORM = 0x40;
const TEXTURE_BINDING = 0x04;
const TEXTURE_COPY_DST = 0x02;

const BLENDING = {
    color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
};

/**
 * Draws the snow with WebGPU. Returns null where WebGPU or a suitable adapter is missing; `onLost` is
 * called if the device is lost later (the page then falls back to the canvas renderer).
 */
export async function createWebGpuRenderer(
    canvas: OffscreenCanvas,
    onLost: () => void,
): Promise<SnowRenderer | null> {
    const gpu = (navigator as unknown as { gpu?: GPU }).gpu;
    if (!gpu) {
        return null;
    }
    const adapter = await gpu.requestAdapter({ powerPreference: 'low-power' });
    if (!adapter) {
        return null;
    }
    const device = await adapter.requestDevice();
    const context = canvas.getContext(
        'webgpu' as OffscreenRenderingContextId,
    ) as unknown as GPUCanvasContext | null;
    if (!context) {
        device.destroy();

        return null;
    }
    const format = gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });

    device.pushErrorScope('validation');
    const pipeline = (code: string, buffers: object[]) => {
        const module = device.createShaderModule({ code });

        return device.createRenderPipeline({
            layout: 'auto',
            vertex: { module, entryPoint: 'vertex', buffers },
            fragment: {
                module,
                entryPoint: 'fragment',
                targets: [{ format, blend: BLENDING }],
            },
            primitive: { topology: 'triangle-list' },
        });
    };
    const snowmanPipeline = pipeline(SNOWMAN_SHADER, []);
    const driftPipeline = pipeline(DRIFT_SHADER, []);
    const particlePipeline = pipeline(PARTICLE_SHADER, [
        {
            arrayStride: INSTANCE_FLOATS * 4,
            stepMode: 'instance',
            attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x4' },
                { shaderLocation: 1, offset: 16, format: 'float32x4' },
            ],
        },
    ]);
    const invalid = await device.popErrorScope();
    if (invalid) {
        console.warn('Snow: WebGPU shaders were rejected.', invalid.message);
        device.destroy();

        return null;
    }

    const globals = new Float32Array(GLOBALS_FLOATS);
    const globalsBuffer = device.createBuffer({
        size: globals.byteLength,
        usage: UNIFORM | COPY_DST,
    });
    const bindGlobals = (target: GPURenderPipeline) =>
        device.createBindGroup({
            layout: target.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: globalsBuffer } }],
        });
    const snowmanBinding = bindGlobals(snowmanPipeline);
    const particleBinding = bindGlobals(particlePipeline);
    let driftBinding: GPUBindGroup | null = null;
    let depthTexture: GPUTexture | null = null;
    let depthColumns = 0;
    let instanceBuffer: GPUBuffer | null = null;
    let instanceCapacity = 0;
    let destroyed = false;
    let width = 1;
    let height = 1;
    let ratio = 1;

    void device.lost.then(() => {
        if (!destroyed) {
            onLost();
        }
    });

    return {
        resize(newWidth, newHeight, newRatio) {
            width = newWidth;
            height = newHeight;
            ratio = newRatio;
            canvas.width = Math.max(1, Math.round(width * ratio));
            canvas.height = Math.max(1, Math.round(height * ratio));
        },

        render(simulation: Simulation, time: number, isDark: boolean) {
            const depths = simulation.drift.depths;
            if (depths.length === 0) {
                return;
            }
            if (depths.length !== depthColumns) {
                depthTexture?.destroy();
                depthColumns = depths.length;
                depthTexture = device.createTexture({
                    size: [depthColumns, 1],
                    format: 'r32float',
                    usage: TEXTURE_BINDING | TEXTURE_COPY_DST,
                });
                driftBinding = device.createBindGroup({
                    layout: driftPipeline.getBindGroupLayout(0),
                    entries: [
                        { binding: 0, resource: { buffer: globalsBuffer } },
                        { binding: 1, resource: depthTexture.createView() },
                    ],
                });
            }
            if (!depthTexture || !driftBinding) {
                return;
            }
            device.queue.writeTexture(
                { texture: depthTexture },
                depths,
                { bytesPerRow: depthColumns * 4 },
                [depthColumns, 1],
            );

            const count = simulation.instanceCount;
            if (count > instanceCapacity) {
                instanceBuffer?.destroy();
                instanceCapacity = Math.ceil(count / 512) * 512;
                instanceBuffer = device.createBuffer({
                    size: instanceCapacity * INSTANCE_FLOATS * 4,
                    usage: VERTEX | COPY_DST,
                });
            }
            if (instanceBuffer && count > 0) {
                device.queue.writeBuffer(
                    instanceBuffer,
                    0,
                    simulation.instances,
                    0,
                    count * INSTANCE_FLOATS,
                );
            }

            const snowman = simulation.snowman;
            globals[0] = width;
            globals[1] = height;
            globals[2] = ratio;
            globals[3] = time;
            globals[4] = isDark ? 1 : 0;
            globals[5] = depthColumns;
            globals[6] = COLUMN_WIDTH;
            globals[7] = MAX_DEPTH;
            globals[8] = snowman.x;
            globals[9] = snowman.growth[0];
            globals[10] = snowman.growth[1];
            globals[11] = snowman.growth[2];
            globals[12] = snowman.dressed;
            globals[13] = snowman.outline;
            globals[14] = snowman.lean;
            globals[15] = snowman.waving;
            globals[16] = simulation.wind.direction;
            device.queue.writeBuffer(globalsBuffer, 0, globals);

            const encoder = device.createCommandEncoder();
            const pass = encoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: context.getCurrentTexture().createView(),
                        clearValue: { r: 0, g: 0, b: 0, a: 0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            });
            if (simulation.interactive) {
                if (snowman.growth[0] > 0 || snowman.outline > 0.01) {
                    pass.setPipeline(snowmanPipeline);
                    pass.setBindGroup(0, snowmanBinding);
                    pass.draw(6);
                }
                pass.setPipeline(driftPipeline);
                pass.setBindGroup(0, driftBinding);
                pass.draw(6);
            }
            if (instanceBuffer && count > 0) {
                pass.setPipeline(particlePipeline);
                pass.setBindGroup(0, particleBinding);
                pass.setVertexBuffer(0, instanceBuffer);
                pass.draw(6, count);
            }
            pass.end();
            device.queue.submit([encoder.finish()]);
        },

        destroy() {
            destroyed = true;
            depthTexture?.destroy();
            instanceBuffer?.destroy();
            globalsBuffer.destroy();
            device.destroy();
        },
    };
}
