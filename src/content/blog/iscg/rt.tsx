import { useScrollDetector } from "@/components/react/scroll-detector";
import { useCallback, useEffect, useRef, useState } from "react";
import { Vector2, Vector3, Vector4 } from "three";

const objectLibrary = /* wgsl */ `
struct Sphere {
  center: vec3<f32>, // x, y, z
  radius: f32, // radius
  color: vec4<f32>, // r, g, b, a
}`;

const vertexLibrary = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}`;

const cameraLibrary = /* wgsl */ `
struct Camera {
  viewport: vec2<f32>, // width, height
  fovy: f32, // field of view in radians
  aspect: f32, // aspect ratio (width / height)
  position: vec3<f32>, // x, y, z
  direction: vec3<f32>, // x, y, z
  up: vec3<f32>, // x, y, z
}`;

const WORKGROUP_SIZE_X = 8;
const WORKGROUP_SIZE_Y = 8;

const computeShader = /* wgsl */ `
${cameraLibrary}
${objectLibrary}

@group(0) @binding(0) var<storage, read_write> imageBuffer: array<vec4<f32>>;
@group(0) @binding(1) var<uniform> camera: Camera;
@group(0) @binding(2) var<uniform> renderMode: u32;
@group(0) @binding(3) var<storage, read> objects: array<Sphere>;


const circleCenter = vec3<f32>(0.0, 0.0, 0.0);
const circleRadius = 10.0;
const circleColor = vec4<f32>(0.0, 0.0, 1.0, 1.0); 


@compute @workgroup_size(${WORKGROUP_SIZE_X}, ${WORKGROUP_SIZE_Y}, 1)
fn computeMain(@builtin(global_invocation_id) gId: vec3<u32>) {
  let viewport = vec2<u32>(camera.viewport);

  if (gId.x >= viewport.x || gId.y >= viewport.y) {
    return;
  }

  let pixel = gId.x + gId.y * viewport.x;
  
  let center = camera.viewport / vec2<f32>(2.0);
  let uv = vec2<f32>(f32(gId.x), f32(gId.y));

  if (renderMode == 0) {
    let radius = 100.0;
    let d = distance(uv, center);
    var color: vec4<f32> = vec4<f32>(0.0, 0.0, 0.0, 1.0);

    if (d < radius) {
      color = vec4<f32>(0.0, 1.0, 0.0, 1.0); // Green
    } 
    imageBuffer[pixel] = color;
  }

  if (renderMode == 1) {
    let origin = camera.position;
    let direction = normalize(camera.direction);
    let up = normalize(camera.up);
    let right = normalize(cross(direction, up));
    let fovScale = tan(camera.fovy / 2.0);
    let aspect = camera.aspect;

    // tan(fov / 2) unit * aspect
    // _______________________
    // |                     |
    // |  x_______.          |
    // |__|_______0          | tan(fov / 2) unit
    // |          |          |
    // |          |          |
    // |__________|__________|
    //            | 1 unit
    //            |
                                                          // shift the center 
             // but the fovScale is in the range of [-1, 1] so * 2
                                      // normalize to 1 unit
                     // center the ray inside the pixel 
    let Px = (2.0 * (f32(gId.x) + 0.5) / camera.viewport.x - 1.0);
    let Py = (1.0 - 2.0 * (f32(gId.y) + 0.5) / camera.viewport.y); 
    // Py is the same but inverted because uv.y 0 starts from the top left corner

    let x = Px * fovScale * aspect;
    let y = Py * fovScale;

    let rayDirection = normalize(
      direction + x * right + y * up
    );

    //                ____ 
    //          a ____   \b__----___
    //       ____         /\\        \
    //   <___            (  \\r       )
    // x <-------oc-----(------        )
    //                   (            )
    //                    \\---___---//
    //
    //

    let oc = origin - circleCenter;
    let a = dot(oc, rayDirection);
    let b = dot(oc, oc) - a * a - circleRadius * circleRadius;

    let hit = b < 0.0 && a < 0.0;

    var color: vec4<f32>;
    if (hit) {
      color = circleColor;
    } else {
      color = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    }
  
    imageBuffer[pixel] = color;
  }

  if (renderMode == 2) {
    let origin = camera.position;
    let direction = normalize(camera.direction);
    let up = normalize(camera.up);
    let right = normalize(cross(direction, up));
    let fovScale = tan(camera.fovy / 2.0);
    let aspect = camera.aspect;

    let Px = (2.0 * (f32(gId.x) + 0.5) / camera.viewport.x - 1.0);
    let Py = (1.0 - 2.0 * (f32(gId.y) + 0.5) / camera.viewport.y); 
    let x = Px * fovScale * aspect;
    let y = Py * fovScale;

    let rayDirection = normalize(
      direction + x * right + y * up
    );

    var color = vec4<f32>(0.3, 0.6, 0.8, 1.0);
    var t = 1000.0;
  
    for (var i = 0u; i < arrayLength(&objects); i++) {
      let sphere = objects[i];
      let oc = sphere.center - origin; // it's confusing when it's negative. i had to change
      let a = dot(oc, rayDirection);
      let b = dot(oc, oc) - a * a;

      if (b > sphere.radius * sphere.radius) {
        continue;
      }

      let d = sqrt(sphere.radius * sphere.radius - b);
      var t0 = a - d; // near intersection
      let t1 = a + d; // far intersection

      if (t0 < 0.0 && t1 < 0.0) {
        continue; // we are behind the sphere
      }

      if (t0 < 0.0) {
        t0 = t1; // we are behind the near intersection, take the far one
      }

      if (t0 < t) {
        t = t0; // we found a closer intersection
        color = sphere.color; // use the sphere color
      }
    }

    imageBuffer[pixel] = color;
  }
}
`;

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
  let viewport = vec2<u32>(camera.viewport);
  let x = u32(f32(uv.x) * camera.viewport.x);
  let y = u32(f32(uv.y) * camera.viewport.y);
  let index = clamp(x + y * viewport.x, 0u, viewport.x * viewport.y - 1u);
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

const RENDER_MODES = {
  GPU_BALL: 0,
  RAY_TRACING_BASIC: 1,
  MULTIPLE_BALLS: 2,
};

type RenderModeType = keyof typeof RENDER_MODES;

class RenderMode implements StateBuffer<Uint32Array> {
  data: Uint32Array = new Uint32Array(1); // Single mode value
  device: GPUDevice;
  buffer: GPUBuffer;

  private readonly bufferConfig = () => ({
    label: "Render Mode Buffer",
    size: this.data.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  constructor(device: GPUDevice, initialMode: number = 0) {
    this.device = device;
    this.data[0] = initialMode;
    this.buffer = this.createBuffer();
  }

  writeBuffer() {
    this.device.queue.writeBuffer(this.buffer, 0, this.data);
  }

  createBuffer() {
    this.buffer?.destroy();
    this.buffer = this.device.createBuffer(this.bufferConfig());
    return this.buffer;
  }

  destroy() {
    this.buffer?.destroy();
  }

  set mode(mode: RenderModeType | number) {
    this.data[0] = typeof mode === "string" ? RENDER_MODES[mode] : mode;
    this.writeBuffer();
  }
}

class Camera implements StateBuffer<Float32Array> {
  readonly viewport: Vector2;
  readonly fovy: number;
  // readonly aspect: number;

  get aspect() {
    return this.viewport.x / this.viewport.y;
  }

  readonly position: Vector3;
  readonly direction: Vector3;
  readonly up: Vector3;

  get properties() {
    return [
      { name: "viewport", size: 2 },
      { name: "fovy", size: 1 },
      { name: "aspect", size: 1 },
      { name: "position", size: 4 },
      { name: "direction", size: 4 },
      { name: "up", size: 4 },
    ];
  }

  readonly data: Float32Array = new Float32Array(
    this.properties.reduce((sum, prop) => sum + prop.size, 0),
  );

  device: GPUDevice;
  buffer: GPUBuffer;

  private readonly bufferConfig = () => ({
    label: "Camera Buffer",
    size: this.data.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  constructor(
    device: GPUDevice,
    viewport: [number, number],
    position: Vector3 = new Vector3(0, 0, 50),
    direction: Vector3 = new Vector3(0, 0, -1), // -Z
    up: Vector3 = new Vector3(0, 1, 0), // Y
    fovy: number = Math.PI / 2,
  ) {
    this.device = device;
    this.position = position;
    this.viewport = new Vector2(viewport[0], viewport[1]);
    this.direction = direction;
    this.up = up;
    this.fovy = fovy;
    this.buffer = this.createBuffer();
  }

  createBuffer() {
    this.buffer?.destroy();
    this.buffer = this.device.createBuffer(this.bufferConfig());
    return this.buffer;
  }

  writeBuffer() {
    for (let i = 0, offset = 0; i < this.properties.length; i++) {
      const prop = this.properties[i];
      const value = this[prop.name as keyof Camera];
      const size = prop.size;

      if (value instanceof Vector2 || value instanceof Vector3) {
        this.data.set(value.toArray(), offset);
      } else if (typeof value === "number") {
        this.data[offset] = value;
      } else {
        throw new Error(`Unsupported type for property ${prop.name}`);
      }

      offset += size;
    }
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

class Sphere {
  position: Vector3;
  radius: number;
  color: Vector4;

  data: Float32Array;
  static readonly size = 8;

  constructor(
    position: Vector3 = new Vector3(0, 0, 0),
    radius: number = 20,
    color: Vector4 = new Vector4(0, 0, 1.0, 1.0),
  ) {
    this.position = position;
    this.radius = radius;
    this.color = color;
    this.data = new Float32Array([
      ...this.position.toArray(),
      this.radius,
      ...this.color.toArray(),
    ]);
  }
}

class SceneObjectState implements StateBuffer<Float32Array> {
  data: Float32Array;
  device: GPUDevice;
  buffer: GPUBuffer;
  objects: Sphere[];

  private readonly bufferConfig = () => ({
    label: "Scene Object Buffer",
    size: this.data.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  constructor(device: GPUDevice, objects: Sphere[] = []) {
    this.device = device;
    this.objects = objects;
    this.data = new Float32Array(objects.length * Sphere.size);
    this.buffer = this.createBuffer();
    this.writeBuffer();
  }

  addObject(object: Sphere) {
    this.objects.push(object);
    this.resizeBuffer();
    this.writeBuffer();
  }

  resizeBuffer() {
    const newSize = this.objects.length * Sphere.size;
    if (this.data.length < newSize) {
      const newData = new Float32Array(newSize);
      newData.set(this.data);
      this.data = newData;
    }
  }

  writeBuffer() {
    for (let i = 0; i < this.objects.length; i++) {
      const object = this.objects[i];
      const offset = i * Sphere.size;
      this.data.set(object.data, offset);
    }
    this.device.queue.writeBuffer(this.buffer, 0, this.data);
  }

  createBuffer() {
    this.buffer?.destroy();
    this.buffer = this.device.createBuffer(this.bufferConfig());
    return this.buffer;
  }

  destroy() {
    this.buffer?.destroy();
  }
}

class RayTracingState {
  imageBuffer: ImageBuffer;
  camera: Camera;
  renderMode: RenderMode;
  objects: SceneObjectState;

  constructor(canvas: HTMLCanvasElement, device: GPUDevice) {
    this.imageBuffer = new ImageBuffer(device, canvas.width, canvas.height);
    this.camera = new Camera(device, [canvas.width, canvas.height]);
    this.renderMode = new RenderMode(device);
    this.objects = new SceneObjectState(device, [
      new Sphere(new Vector3(0, 0, 0), 10),
      new Sphere(new Vector3(20, 20, 0), 15),
      new Sphere(new Vector3(-20, -20, 0), 12),
    ]);
  }

  setFromCanvas(canvas: HTMLCanvasElement) {
    this.imageBuffer.set(canvas.width, canvas.height);
    this.camera.viewport.set(canvas.width, canvas.height);
  }

  setRenderMode(mode: RenderModeType | number) {
    this.renderMode.mode = mode;
  }

  destroy() {
    this.imageBuffer.destroy();
    this.camera.destroy();
    this.renderMode.destroy();
    this.objects.destroy();
  }
}

class RayTracingRenderer {
  observer: ResizeObserver;
  canvas: HTMLCanvasElement;

  private device!: GPUDevice;
  private context: GPUCanvasContext;
  private format: GPUTextureFormat;

  private renderPipeline!: GPURenderPipeline;
  private computePipeline!: GPUComputePipeline;

  private renderBindGroup?: GPUBindGroup;
  private computeBindGroup?: GPUBindGroup;

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

  get computePassDescriptor() {
    return {
      label: "computePass",
    };
  }

  handleResize() {
    if (!this.isInitialized()) {
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

    this.renderBindGroup = this.device.createBindGroup({
      label: "renderBindGroup",
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

    // Create the render bind group
    if (this.scrollPassed("gpu-ball")) {
      this.computeBindGroup = this.device.createBindGroup({
        label: "computeBindGroup",
        layout: this.computePipeline.getBindGroupLayout(0),
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
          {
            binding: 2,
            resource: {
              buffer: this.state.renderMode.buffer,
            },
          },
          {
            binding: 3,
            resource: {
              buffer: this.state.objects.buffer,
            },
          },
        ],
      });
    }

    if (
      this.scrollPassed("gpu-ball") &&
      !this.scrollPassed("ray-tracing-basic")
    ) {
      this.state.setRenderMode("GPU_BALL");
    }

    if (
      this.scrollPassed("ray-tracing-basic") &&
      !this.scrollPassed("multiple-balls")
    ) {
      this.state.setRenderMode("RAY_TRACING_BASIC");
    }

    if (this.scrollPassed("multiple-balls")) {
      this.state.setRenderMode("MULTIPLE_BALLS");
      this.state.objects.writeBuffer();
    }

    const shouldPaint =
      this.scrollPassed("cpu-ball") && !this.scrollPassed("gpu-ball");

    this.state.camera.writeBuffer();

    if (shouldPaint) {
      this.paint();
      this.state.imageBuffer.writeBuffer();
    }

    this.state.renderMode.writeBuffer();
  }

  paint() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const radius = 100;

    for (let i = 0; i < this.state.imageBuffer.data.length; i += 4) {
      const x = (i / 4) % this.canvas.width;
      const y = Math.floor(i / 4 / this.canvas.width);
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < radius) {
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
  }

  isInitialized() {
    const ready =
      !!this.device &&
      !!this.context &&
      !!this.format &&
      !!this.renderPipeline &&
      !!this.computePipeline &&
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
      alphaMode: "premultiplied",
    });

    await Promise.all([
      this.createRenderPipeline(),
      this.createComputePipeline(),
    ]);

    if (!this.isInitialized()) {
      throw Error("Renderer is not initialized.");
    }

    this.handleResize();
    this.observer.observe(this.canvas);
  }

  private async createRenderPipeline() {
    const shaderModule = this.device.createShaderModule({
      label: "presentShader",
      code: presentShader,
    });

    this.renderPipeline = await this.device.createRenderPipelineAsync({
      label: "presentPipeline",
      layout: "auto",
      vertex: {
        module: shaderModule,
      },
      fragment: {
        module: shaderModule,
        targets: [
          {
            format: this.format,
          },
        ],
      },
    });
  }

  private async createComputePipeline() {
    const shaderModule = this.device.createShaderModule({
      label: "computeShader",
      code: computeShader,
    });

    this.computePipeline = await this.device.createComputePipelineAsync({
      label: "computePipeline",
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "computeMain",
      },
    });
  }

  render() {
    if (
      !this.isInitialized() ||
      !this.renderPipeline ||
      (this.scrollPassed("gpu-ball") && !this.computePipeline)
    ) {
      throw Error(
        "Renderer is not initialized. Please check if it's initialized before calling this method.",
      );
    }

    const commandEncoder = this.device.createCommandEncoder({
      label: "renderEncoder",
    });

    if (this.scrollPassed("gpu-ball")) {
      const computePass = commandEncoder.beginComputePass(
        this.computePassDescriptor,
      );

      computePass.setPipeline(this.computePipeline);
      computePass.setBindGroup(0, this.computeBindGroup);
      computePass.dispatchWorkgroups(
        Math.ceil(this.canvas.width / WORKGROUP_SIZE_X),
        Math.ceil(this.canvas.height / WORKGROUP_SIZE_Y),
      );
      computePass.end();
    }

    const renderPass = commandEncoder.beginRenderPass(
      this.renderPassDescriptor,
    );

    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.renderBindGroup);
    renderPass.draw(6, 1, 0, 0);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }
}
