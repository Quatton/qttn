import { useScrollDetector } from "@/components/react/scroll-detector";
import { useCallback, useEffect, useRef, useState } from "react";

const vertexLibrary = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}
`;

const cameraLibrary = /* wgsl */ `
struct Camera {
  viewport: vec2<u32>, // width, height
}`;

const presentShader = /* wgsl */ `
  ${vertexLibrary}
  ${cameraLibrary}

  // image buffer rgba
  @group(0) @binding(0) var<storage, read> imageBuffer: array<vec4<f32>>;
  @group(0) @binding(1) var<uniform> camera: Camera;

  // 0,0
  // 0________________1,3
  // |               /|
  // |             /  |
  // |           /    |
  // |         /      |
  // |       /        |
  // |     /          |
  // |   /            |
  // | /              |
  // 2,4______________|5 1,1

  const XYUV = array<vec4<f32>, 6>(
    vec4(-1.0, 1.0, 0.0, 0.0),   // 0
    vec4(1.0, 1.0, 1.0, 0.0),    // 1
    vec4(-1.0, -1.0, 0.0, 1.0),  // 2
    vec4(1.0, 1.0, 1.0, 0.0),    // 3
     vec4(-1.0, -1.0, 0.0, 1.0), // 4
    vec4(1.0, -1.0, 1.0, 1.0)    // 5
  );

  @vertex
  fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4(XYUV[vertexIndex].xy, 0.0, 1.0);
    output.uv = XYUV[vertexIndex].zw;
    return output;
  }

  @fragment
  fn fragmentMain(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let x = u32(f32(uv.x) * f32(camera.viewport.x));
    let y = u32(f32(uv.y) * f32(camera.viewport.y));
    let index = clamp(x + y * camera.viewport.x, 0u, camera.viewport.x * camera.viewport.y - 1u);
    return imageBuffer[index];
  }
`;

export function RayTracing() {
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<RayTracingRenderer | null>(null);
  const frameId = useRef<number | null>(null);

  const { scrollPassed } = useScrollDetector(
    (scrollPassed: (id: string) => boolean) => {
      if (!rendererRef.current) {
        return;
      }
      rendererRef.current.handleResize();
    },
  );

  const initRayTracing = useCallback(
    async (canvas: HTMLCanvasElement) => {
      rendererRef.current ??= new RayTracingRenderer(canvas, scrollPassed);
      const renderer = rendererRef.current;
      if (!renderer.isInitialized()) {
        try {
          await renderer.init();

          const loop = () => {
            renderer.render();
            frameId.current = requestAnimationFrame(loop);
          };

          loop();
        } catch (err) {
          console.error(err);
          setError(
            err instanceof Error ? err.message : "Failed to initialize WebGPU.",
          );
          return;
        }
      }
    },
    [setError],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setError("Canvas is not available.");
      return;
    }

    initRayTracing(canvas);

    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
      if (frameId.current) {
        cancelAnimationFrame(frameId.current);
      }
    };
  }, [initRayTracing]);

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {!error ? (
        <canvas ref={canvasRef} className="h-full w-full" />
      ) : (
        <div className="text-center text-red-500">{error}</div>
      )}
    </div>
  );
}

interface StateBuffer<T extends TypedArray> {
  data: T;
  device: GPUDevice;
  buffer: GPUBuffer;
  writeBuffer: () => void;
  createBuffer: () => GPUBuffer;
  destroy: () => void;
}

class Camera implements StateBuffer<Uint32Array> {
  data: Uint32Array = new Uint32Array(2);

  device: GPUDevice;
  buffer: GPUBuffer;

  private readonly viewportOffset = 0;

  private readonly bufferConfig = () => ({
    label: "Camera Buffer",
    size: this.data.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  constructor(device: GPUDevice, viewport: [number, number]) {
    this.device = device;
    this.viewport = viewport;
    this.buffer = this.createBuffer();
  }

  get viewport(): [number, number] {
    return [this.data[0], this.data[1]];
  }

  set viewport(viewport: [number, number]) {
    this.data.set(viewport, this.viewportOffset);
  }

  createBuffer() {
    this.buffer?.destroy();
    this.buffer = this.device.createBuffer(this.bufferConfig());
    return this.buffer;
  }

  writeBuffer() {
    this.device.queue.writeBuffer(this.buffer, 0, this.data);
  }

  destroy() {
    this.buffer?.destroy();
  }
}

class ImageBuffer implements StateBuffer<Float32Array> {
  data: Float32Array;
  width: number;
  height: number;
  size: number;

  device: GPUDevice;
  buffer: GPUBuffer;

  private readonly bufferConfig = () => ({
    label: "Image Buffer",
    size: this.data.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  writeBuffer() {
    this.device.queue.writeBuffer(this.buffer, 0, this.data);
  }

  constructor(device: GPUDevice, width: number, height: number) {
    this.device = device;
    this.width = width;
    this.height = height;
    this.size = this.width * this.height * 4;
    this.data = new Float32Array(this.size);
    this.buffer = this.createBuffer();
  }

  set(width: number, height: number) {
    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;
      this.size = this.width * this.height * 4;
      this.data = new Float32Array(this.size);
      this.createBuffer();
    }
  }

  createBuffer() {
    this.buffer?.destroy();
    this.buffer = this.device.createBuffer(this.bufferConfig());
    return this.buffer;
  }

  destroy() {
    this.buffer.destroy();
  }
}

class RayTracingState {
  imageBuffer: ImageBuffer;
  camera: Camera;
  constructor(canvas: HTMLCanvasElement, device: GPUDevice) {
    this.imageBuffer = new ImageBuffer(device, canvas.width, canvas.height);
    this.camera = new Camera(device, [canvas.width, canvas.height]);
  }

  setFromCanvas(canvas: HTMLCanvasElement) {
    this.imageBuffer.set(canvas.width, canvas.height);
    this.camera.viewport = [canvas.width, canvas.height];
  }

  destroy() {
    this.imageBuffer.destroy();
    this.camera.destroy();
  }
}

class RayTracingRenderer {
  observer: ResizeObserver;
  canvas: HTMLCanvasElement;

  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  private renderPipeline!: GPURenderPipeline;
  private bindGroup: GPUBindGroup | undefined;
  scrollPassed: (id: string) => boolean;

  state!: RayTracingState;

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.device) {
      this.device.destroy();
    }
    if (this.context) {
      this.context.unconfigure();
    }
    this.state.destroy();
  }

  // in WebGPU world, we get adapter and then we throw it away so I don't really need to store it
  constructor(
    canvas: HTMLCanvasElement,
    scrollPassed: (id: string) => boolean,
  ) {
    this.canvas = canvas;
    this.scrollPassed = scrollPassed;

    const context = this.canvas.getContext("webgpu");

    if (!context) {
      throw new Error("WebGPU is not supported in this browser.");
    }

    this.context = context;
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.observer = new ResizeObserver((entries) => {
      if (!this.isInitialized()) {
        return;
      }
      for (const entry of entries) {
        if (entry.target === this.canvas) {
          this.handleResize();
          break;
        }
      }
    });
    // I should call init() here but I want to await it but I can't in constructor
    // so I will call it in the initRayTracing function instead
  }

  get renderPassDescriptor() {
    return {
      label: "renderPass",
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          loadOp: "clear" as const,
          storeOp: "store" as const,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    };
  }

  handleResize() {
    if (!this.device) {
      // Non-error return (maybe it's just not initialized yet. pls chill)
      return;
    }

    const canvas = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(
      1,
      Math.min(
        Math.floor(canvas.clientWidth * dpr),
        this.device.limits.maxTextureDimension2D,
      ),
    );
    const height = Math.max(
      1,
      Math.min(
        Math.floor(canvas.clientHeight * dpr),
        this.device.limits.maxTextureDimension2D,
      ),
    );
    canvas.width = width;
    canvas.height = height;

    this.state.setFromCanvas(canvas);
    this.bindGroup = this.device.createBindGroup({
      label: "bindGroup",
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.state.imageBuffer.buffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.state.camera.buffer,
          },
        },
      ],
    });

    this.paint();
  }

  paint() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const radius = 100;

    const shouldPaint =
      this.scrollPassed("rt-ball") && !this.scrollPassed("hide-rt-ball");

    for (let i = 0; i < this.state.imageBuffer.data.length; i += 4) {
      const x = (i / 4) % this.canvas.width;
      const y = Math.floor(i / 4 / this.canvas.width);
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < radius && shouldPaint) {
        this.state.imageBuffer.data[i] = 1; // R
        this.state.imageBuffer.data[i + 1] = 0; // G
        this.state.imageBuffer.data[i + 2] = 0; // B
        this.state.imageBuffer.data[i + 3] = 1; // A
      } else {
        this.state.imageBuffer.data[i] = 0; // R
        this.state.imageBuffer.data[i + 1] = 0; // G
        this.state.imageBuffer.data[i + 2] = 0; // B
        this.state.imageBuffer.data[i + 3] = 1; // A
      }
    }
    this.state.imageBuffer.writeBuffer();
    this.state.camera.writeBuffer();
  }

  isInitialized() {
    const ready =
      !!this.device &&
      !!this.context &&
      !!this.format &&
      !!this.renderPipeline &&
      !!this.state;

    return ready;
  }

  async init() {
    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter?.requestDevice();

    if (!device) {
      throw Error("Failed to create WebGPU device.");
    }

    this.device = device;
    this.state = new RayTracingState(this.canvas, this.device);

    this.context.configure({
      device: this.device,
      format: this.format,
    });

    const shaderModule = this.device.createShaderModule({
      label: "presentShader",
      code: presentShader,
    });

    this.renderPipeline = this.device.createRenderPipeline({
      label: "presentPipeline",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets: [
          {
            format: this.format,
          },
        ],
      },
    });

    if (!this.isInitialized()) {
      throw Error("Renderer is not initialized.");
    }

    this.handleResize();
    this.observer.observe(this.canvas);
  }

  render() {
    if (!this.isInitialized()) {
      throw Error(
        "Renderer is not initialized. Please check if it's initialized before calling this method.",
      );
    }

    const commandEncoder = this.device.createCommandEncoder({
      label: "renderEncoder",
    });

    const renderPass = commandEncoder.beginRenderPass(
      this.renderPassDescriptor,
    );

    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(6, 1, 0, 0);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }
}
