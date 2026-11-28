import { COLUMN_WIDTH, MAX_DEPTH } from './drift';
import {
    MODEL_MAX_PARTS,
    MODEL_VERTEX_BYTES,
    SPRITE_DEPTH,
    SPRITE_HALF,
} from './models';
import type { SnowModel, ToolPose } from './models';
import type { SnowRenderer } from './renderer';
import {
    DRIFT_SHADER,
    MODEL_SHADER,
    PARTICLE_SHADER,
    SNOWMAN_SHADER,
    SPRITE_SHADER,
} from './shaders';
import { INSTANCE_FLOATS } from './simulation';
import type { Simulation } from './simulation';

const GLOBALS_FLOATS = 20;
// GPUBufferUsage and GPUTextureUsage flags.
const COPY_DST = 0x08;
const VERTEX = 0x20;
const UNIFORM = 0x40;
const TEXTURE_BINDING = 0x04;
const TEXTURE_COPY_DST = 0x02;
const RENDER_ATTACHMENT = 0x10;
const SPRITE_FORMAT = 'rgba8unorm';
const SPRITE_SAMPLES = 4;
/** A model's matrices followed by one vec4 of settings. */
const MODEL_FLOATS = MODEL_MAX_PARTS * 16 + 4;

/** A tool's model on the GPU, with the texture it is drawn into before it is placed on the page. */
type Sprite = {
    vertices: GPUBuffer;
    vertexCount: number;
    uniforms: Float32Array;
    uniformBuffer: GPUBuffer;
    modelBinding: GPUBindGroup;
    rect: Float32Array;
    rectBuffer: GPUBuffer;
    target: GPUTexture | null;
    resolved: GPUTexture | null;
    depth: GPUTexture | null;
    pageBinding: GPUBindGroup | null;
    drawn: boolean;
};

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
    const pipeline = (code: string, buffers: object[], extra: object = {}) => {
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
            ...extra,
        });
    };
    const spritePipeline = pipeline(SPRITE_SHADER, []);
    const modelModule = device.createShaderModule({ code: MODEL_SHADER });
    const modelPipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: modelModule,
            entryPoint: 'vertex',
            buffers: [
                {
                    arrayStride: MODEL_VERTEX_BYTES,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'snorm16x4' },
                        { shaderLocation: 1, offset: 8, format: 'snorm8x4' },
                        { shaderLocation: 2, offset: 12, format: 'unorm8x4' },
                    ],
                },
            ],
        },
        fragment: {
            module: modelModule,
            entryPoint: 'fragment',
            targets: [{ format: SPRITE_FORMAT }],
        },
        primitive: { topology: 'triangle-list' },
        depthStencil: {
            format: 'depth24plus',
            depthWriteEnabled: true,
            depthCompare: 'less',
        },
        multisample: { count: SPRITE_SAMPLES },
    });
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
    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
    });
    let sprites: { shovel: Sprite; blower: Sprite } | null = null;
    let spriteSide = 0;
    let destroyed = false;
    let width = 1;
    let height = 1;
    let ratio = 1;

    const createSprite = (model: SnowModel): Sprite => {
        const vertices = device.createBuffer({
            size: model.data.byteLength,
            usage: VERTEX | COPY_DST,
        });
        device.queue.writeBuffer(vertices, 0, model.data);
        const uniformBuffer = device.createBuffer({
            size: MODEL_FLOATS * 4,
            usage: UNIFORM | COPY_DST,
        });

        return {
            vertices,
            vertexCount: model.vertexCount,
            uniforms: new Float32Array(MODEL_FLOATS),
            uniformBuffer,
            modelBinding: device.createBindGroup({
                layout: modelPipeline.getBindGroupLayout(0),
                entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
            }),
            rect: new Float32Array(4),
            rectBuffer: device.createBuffer({
                size: 16,
                usage: UNIFORM | COPY_DST,
            }),
            target: null,
            resolved: null,
            depth: null,
            pageBinding: null,
            drawn: false,
        };
    };

    /** Draw a posed model into its own texture; it is placed on the page in the main pass. */
    const drawSprite = (
        encoder: GPUCommandEncoder,
        sprite: Sprite,
        pose: ToolPose,
        isDark: boolean,
    ) => {
        sprite.drawn = pose.visible;
        if (!pose.visible) {
            return;
        }
        const side = Math.round(SPRITE_HALF * 2 * ratio);
        if (!sprite.target || side !== spriteSide) {
            sprite.target?.destroy();
            sprite.resolved?.destroy();
            sprite.depth?.destroy();
            sprite.target = device.createTexture({
                size: [side, side],
                format: SPRITE_FORMAT,
                usage: RENDER_ATTACHMENT,
                sampleCount: SPRITE_SAMPLES,
            });
            sprite.depth = device.createTexture({
                size: [side, side],
                format: 'depth24plus',
                usage: RENDER_ATTACHMENT,
                sampleCount: SPRITE_SAMPLES,
            });
            sprite.resolved = device.createTexture({
                size: [side, side],
                format: SPRITE_FORMAT,
                usage: RENDER_ATTACHMENT | TEXTURE_BINDING,
            });
            sprite.pageBinding = device.createBindGroup({
                layout: spritePipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: globalsBuffer } },
                    { binding: 1, resource: { buffer: sprite.rectBuffer } },
                    { binding: 2, resource: sprite.resolved.createView() },
                    { binding: 3, resource: sampler },
                ],
            });
        }
        if (!sprite.target || !sprite.resolved || !sprite.depth) {
            return;
        }
        sprite.uniforms.set(pose.matrices);
        sprite.uniforms[MODEL_MAX_PARTS * 16] = SPRITE_HALF;
        sprite.uniforms[MODEL_MAX_PARTS * 16 + 1] = SPRITE_DEPTH;
        sprite.uniforms[MODEL_MAX_PARTS * 16 + 2] = isDark ? 1 : 0;
        device.queue.writeBuffer(sprite.uniformBuffer, 0, sprite.uniforms);
        // Whole device pixels, so the sprite is not blurred when it is placed.
        sprite.rect[0] = Math.round(pose.x * ratio) / ratio;
        sprite.rect[1] = Math.round(pose.y * ratio) / ratio;
        sprite.rect[2] = side / ratio / 2;
        device.queue.writeBuffer(sprite.rectBuffer, 0, sprite.rect);

        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: sprite.target.createView(),
                    resolveTarget: sprite.resolved.createView(),
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                    loadOp: 'clear',
                    storeOp: 'discard',
                },
            ],
            depthStencilAttachment: {
                view: sprite.depth.createView(),
                depthClearValue: 1,
                depthLoadOp: 'clear',
                depthStoreOp: 'discard',
            },
        });
        pass.setPipeline(modelPipeline);
        pass.setBindGroup(0, sprite.modelBinding);
        pass.setVertexBuffer(0, sprite.vertices);
        pass.draw(sprite.vertexCount);
        pass.end();
    };

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

        setModels(models) {
            sprites = {
                shovel: createSprite(models.shovel),
                blower: createSprite(models.blower),
            };
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
            if (sprites && simulation.interactive) {
                drawSprite(
                    encoder,
                    sprites.blower,
                    simulation.blowerPose,
                    isDark,
                );
                drawSprite(
                    encoder,
                    sprites.shovel,
                    simulation.shovelPose,
                    isDark,
                );
                spriteSide = Math.round(SPRITE_HALF * 2 * ratio);
            }
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
                // The tools stand in the snow: the drift is drawn in front of them.
                for (const sprite of sprites
                    ? [sprites.blower, sprites.shovel]
                    : []) {
                    if (sprite.drawn && sprite.pageBinding) {
                        pass.setPipeline(spritePipeline);
                        pass.setBindGroup(0, sprite.pageBinding);
                        pass.draw(6);
                    }
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
