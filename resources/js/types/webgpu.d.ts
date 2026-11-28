/**
 * The part of the WebGPU API the snow renderer uses (`@/lib/snow/renderer-webgpu`). TypeScript's DOM
 * library does not ship WebGPU types yet; replace this file with `@webgpu/types` if more is needed.
 */
interface GPU {
    requestAdapter(options?: {
        powerPreference?: 'low-power' | 'high-performance';
    }): Promise<GPUAdapter | null>;
    getPreferredCanvasFormat(): string;
}

interface GPUAdapter {
    requestDevice(): Promise<GPUDevice>;
}

interface GPUDevice {
    readonly queue: GPUQueue;
    readonly lost: Promise<{ reason?: string; message: string }>;
    createShaderModule(descriptor: { code: string }): GPUShaderModule;
    createRenderPipeline(descriptor: object): GPURenderPipeline;
    createBuffer(descriptor: { size: number; usage: number }): GPUBuffer;
    createTexture(descriptor: {
        size: [number, number];
        format: string;
        usage: number;
    }): GPUTexture;
    createBindGroup(descriptor: {
        layout: GPUBindGroupLayout;
        entries: { binding: number; resource: object }[];
    }): GPUBindGroup;
    createCommandEncoder(): GPUCommandEncoder;
    pushErrorScope(filter: 'validation' | 'out-of-memory' | 'internal'): void;
    popErrorScope(): Promise<{ message: string } | null>;
    destroy(): void;
}

interface GPUQueue {
    writeBuffer(
        buffer: GPUBuffer,
        bufferOffset: number,
        data: Float32Array,
        dataOffset?: number,
        size?: number,
    ): void;
    writeTexture(
        destination: { texture: GPUTexture },
        data: Float32Array,
        dataLayout: { bytesPerRow: number },
        size: [number, number],
    ): void;
    submit(commandBuffers: GPUCommandBuffer[]): void;
}

interface GPUShaderModule {
    getCompilationInfo(): Promise<{
        messages: { type: string; message: string; lineNum: number }[];
    }>;
}

interface GPURenderPipeline {
    getBindGroupLayout(index: number): GPUBindGroupLayout;
}

interface GPUBindGroupLayout {
    readonly label: string;
}

interface GPUBindGroup {
    readonly label: string;
}

interface GPUBuffer {
    destroy(): void;
}

interface GPUTexture {
    createView(): GPUTextureView;
    destroy(): void;
}

interface GPUTextureView {
    readonly label: string;
}

interface GPUCommandBuffer {
    readonly label: string;
}

interface GPUCommandEncoder {
    beginRenderPass(descriptor: {
        colorAttachments: {
            view: GPUTextureView;
            clearValue: { r: number; g: number; b: number; a: number };
            loadOp: 'clear' | 'load';
            storeOp: 'store' | 'discard';
        }[];
    }): GPURenderPassEncoder;
    finish(): GPUCommandBuffer;
}

interface GPURenderPassEncoder {
    setPipeline(pipeline: GPURenderPipeline): void;
    setBindGroup(index: number, bindGroup: GPUBindGroup): void;
    setVertexBuffer(slot: number, buffer: GPUBuffer): void;
    draw(vertexCount: number, instanceCount?: number): void;
    end(): void;
}

interface GPUCanvasContext {
    configure(configuration: {
        device: GPUDevice;
        format: string;
        alphaMode: 'opaque' | 'premultiplied';
    }): void;
    getCurrentTexture(): GPUTexture;
}
