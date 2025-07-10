import { useCallback, useEffect, useRef, useState } from "react";
import { Vector2, Vector3, Vector4 } from "three";

const componentLibrary = /* wgsl */ `
struct Position {
  value: vec3<f32>, // x, y, z,
  _padding: f32, // padding to align to 16 bytes
}

struct SphereAttribute {
  radius: f32, // radius
}

struct Material {
  color: vec4<f32>,
  materialType: u32,
  roughness: f32,
  metallic: f32,
  specular: f32,
}

struct EntityMetadata {
  position: u32,
  sphere: u32,
  material: u32,
}

const COMPONENT_ID_POSITION = 0u;
const COMPONENT_ID_SPHERE = 1u;
const COMPONENT_ID_MATERIAL = 2u;
const COMPONENT_COUNT = 3u;`;

const objectLibrary = /* wgsl */ `
struct Sphere {
  center: vec3<f32>, // x, y, z
  radius: f32, // radius
  color: vec4<f32>, // r, g, b, a
}`;

const rayLibrary = /* wgsl */ `
struct Ray {
  origin: vec3<f32>, // x, y, z
  direction: vec3<f32>, // x, y, z
}
struct Intersection {
  t: f32, // distance along the ray
  e: i32, // entity ID, could be negative if no intersection
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
${rayLibrary}
${componentLibrary}

@group(0) @binding(0) var<storage, read_write> imageBuffer: array<vec4<f32>>;
@group(0) @binding(1) var<uniform> camera: Camera;
@group(0) @binding(2) var<storage, read> positions: array<Position>;
@group(0) @binding(3) var<storage, read> spheres: array<SphereAttribute>;

@group(0) @binding(4) var<storage, read> materials: array<Material>;
@group(0) @binding(5) var<storage, read> entityMetadata: array<EntityMetadata>;

// Floor materials (arbitrary values)
const floorBaseMaterial = Material(
  vec4<f32>(0.8, 0.8, 0.8, 1.0), // color
  0u, // materialType
  0.5, // roughness
  0.0, // metallic
  0.5  // specular
);
const floorAccentMaterial = Material(
  vec4<f32>(0.2, 0.2, 0.2, 1.0), // color
  0u, // materialType
  0.5, // roughness
  0.0, // metallic
  0.5  // specular
);

const floorGridSize = 10.0;
const floorNormal = vec3<f32>(0.0, 1.0, 0.0);

@compute @workgroup_size(${WORKGROUP_SIZE_X}, ${WORKGROUP_SIZE_Y}, 1)
fn computeMain(@builtin(global_invocation_id) gId: vec3<u32>) {
  let viewport = vec2<u32>(camera.viewport);

  if (gId.x >= viewport.x || gId.y >= viewport.y) {
    return;
  }

  let pixel = gId.x + gId.y * viewport.x;
  
  let center = camera.viewport / vec2<f32>(2.0);
  let uv = vec2<f32>(f32(gId.x), f32(gId.y));

  // Only ECS mode (final state)
  let ray = generateRay(camera, uv);
  let origin = ray.origin;
  let rayDirection = ray.direction;

  let background = vec4<f32>(0.3, 0.6, 0.8, 1.0);
  var color: vec4<f32> = background;


  var intersection = Intersection(
    -1.0,
    -1, // no intersection
  );

  let t = -origin.y / rayDirection.y;
  if (t > 0.0) {
    let position = origin + t * rayDirection;
    let gridX = floor(position.x / floorGridSize);
    let gridY = floor(position.z / floorGridSize);
    let isEven = (gridX + gridY) % 2 == 0;
    intersection.t = t;
    if (isEven) {
      intersection.e = -2; // -2 = base floor
    } else {
      intersection.e = -3; // -3 = accent floor
    }
  }

  for (var e = 0u; e < arrayLength(&entityMetadata); e++) {
    let eMeta = entityMetadata[e];
    if (eMeta.position == 1u && eMeta.sphere == 1u && eMeta.material == 1u) {
      let ni = sphereIntersect(ray, i32(e));
      if (ni.t > 0.0 && ((intersection.t > 0.0 && ni.t < intersection.t)
          || intersection.t <= 0.0)) {
        intersection = ni;
      }
    }
  }



  var normal: vec3<f32>;
  var material: Material;

  if (intersection.t > 0.0) {
    if (intersection.e == -2) {
      normal = floorNormal;
      material = floorBaseMaterial;
    } else if (intersection.e == -3) {
      normal = floorNormal;
      material = floorAccentMaterial;
    } else if (intersection.e >= 0) {
      let eu = u32(intersection.e);
      material = materials[eu];
      if (entityMetadata[eu].sphere == 1u) {
        normal = calculateSphereNormal(ray, intersection);
      }
    }
    color = calculateLighting(normal, material.color);
  }

  imageBuffer[pixel] = color;
}

fn calculateSphereNormal(
  ray: Ray,
  intersection: Intersection,
) -> vec3<f32> {
  let eu = u32(intersection.e);
  let position = positions[eu].value;
  let hitPosition = ray.origin + intersection.t * ray.direction;
  let normal = normalize(hitPosition - position);
  return normal;
}


fn calculateLighting(
  normal: vec3<f32>,
  color: vec4<f32>,
) -> vec4<f32> {
  let ambient = 0.25;
  let lightDirection = normalize(vec3<f32>(1.0, 1.0, 1.0));
  let lightIntensity = max(dot(normal, lightDirection), 0.0);
  let diffuse = ambient + (1.0 - ambient) * lightIntensity;
  
  return vec4<f32>(
    color.rgb * diffuse,
    color.a
  );
}

fn generateRay(
  camera: Camera,
  uv: vec2<f32>,
) -> Ray {
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
  let Px = (2.0 * (uv.x + 0.5) / camera.viewport.x - 1.0);
  let Py = (1.0 - 2.0 * (uv.y + 0.5) / camera.viewport.y); 
  // Py is the same but inverted because uv.y 0 starts from the top left corner

  let x = Px * fovScale * aspect;
  let y = Py * fovScale;

  let rayDirection = normalize(
    direction + x * right + y * up
  );

  return Ray(origin, rayDirection);
}

fn sphereIntersect(
  ray: Ray,
  e: i32,
) -> Intersection {
  let eu = u32(e);
  let center = positions[eu].value;
  let radius = spheres[eu].radius;
  let oc = center - ray.origin;
  let a = dot(oc, ray.direction);
  let b = dot(oc, oc) - a * a - radius * radius;
  var intersection = Intersection(-1.0, e); // no intersection

  if (b < 0.0 && a > 0.0) {
    let d = sqrt(radius * radius - b);
    let t0 = a - d; // near intersection
    let t1 = a + d; // far intersection
    if (t0 > 0.0 || t1 > 0.0) {
      if (t0 < 0.0) {
        intersection.t = t1; // we are behind the near intersection, take the far one
      } else {
        intersection.t = t0; // we found a closer intersection
      }
    }
  }

  return intersection;
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

type System = (rd: RayTracingRenderer) => void;

export function RayTracing() {
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<RayTracingRenderer | null>(null);
  const frameId = useRef<number | null>(null);
  const setupRan = useRef(false);

  function setupRayTracingScene(renderer: RayTracingRenderer) {
    renderer.state.entityRegistry.spawn([
      new PositionComponent(0, 10, 0),
      new SphereComponent(10),
      new MaterialComponent({ color: new Vector4(0.8, 0.8, 0.3, 1.0) }),
    ]);
    renderer.state.entityRegistry.spawn([
      new PositionComponent(15, 15, 5),
      new SphereComponent(15),
      new MaterialComponent({ color: new Vector4(0.8, 0.3, 0.8, 1.0) }),
    ]);
    renderer.state.entityRegistry.spawn([
      new PositionComponent(-20, 12, 0),
      new SphereComponent(12),
      new MaterialComponent({ color: new Vector4(0.3, 0.3, 0.8, 1.0) }),
    ]);
  }

  const initRayTracing = useCallback(
    async (canvas: HTMLCanvasElement) => {
      if (!rendererRef.current) {
        rendererRef.current = new RayTracingRenderer(canvas);
      }
      const renderer = rendererRef.current;
      if (!renderer.isInitialized()) {
        try {
          await renderer.init();

          if (!setupRan.current) {
            setupRayTracingScene(renderer);
            setupRan.current = true;
          }

          const loop = () => {
            renderer.update();
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
        setupRan.current = false;
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

class Camera implements StateBuffer<Float32Array> {
  readonly viewport: Vector2;
  readonly fovy: number;

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
    position: Vector3 = new Vector3(0, 20, 50),
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

class RayTracingState {
  imageBuffer: ImageBuffer;
  camera: Camera;
  entityRegistry: EntityRegistry;

  constructor(canvas: HTMLCanvasElement, device: GPUDevice) {
    this.imageBuffer = new ImageBuffer(device, canvas.width, canvas.height);
    this.camera = new Camera(device, [canvas.width, canvas.height]);
    this.entityRegistry = new EntityRegistry(device);
  }

  setFromCanvas(canvas: HTMLCanvasElement) {
    this.imageBuffer.set(canvas.width, canvas.height);
    this.camera.viewport.set(canvas.width, canvas.height);
  }

  destroy() {
    this.imageBuffer.destroy();
    this.camera.destroy();
    this.entityRegistry.destroy();
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

  state!: RayTracingState;
  systems: System[] = [];

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
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

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
            buffer: this.state.entityRegistry.storage.Position.buffer,
          },
        },
        {
          binding: 3,
          resource: {
            buffer: this.state.entityRegistry.storage.Sphere.buffer,
          },
        },
        {
          binding: 4,
          resource: {
            buffer: this.state.entityRegistry.storage.Material.buffer,
          },
        },
        {
          binding: 5,
          resource: {
            buffer: this.state.entityRegistry.entityMetadataBuffer,
          },
        },
      ],
    });

    this.state.camera.writeBuffer();
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

  update() {
    for (const system of this.systems) {
      system(this);
    }
  }

  render() {
    if (
      !this.isInitialized() ||
      !this.renderPipeline ||
      !this.computePipeline
    ) {
      throw Error(
        "Renderer is not initialized. Please check if it's initialized before calling this method.",
      );
    }

    const commandEncoder = this.device.createCommandEncoder({
      label: "renderEncoder",
    });

    this.state.entityRegistry.writeBuffer();

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

abstract class RayTracingComponent {
  entityRef: Entity | null = null;
  shouldUpdate = true;

  /**
   * Abstract getter for the component's data to be sent to the GPU.
   */
  abstract get data(): ReadonlyArray<number>;

  protected constructor() {
    // The constructor returns a Proxy of the instance.
    // This intercepts any property set, automatically flagging the component
    // and its parent entity as needing a buffer update.
    return new Proxy(this, {
      set: (target, prop, value) => {
        // Update the actual property on the target object
        (target as any)[prop] = value;

        // Mark this component and its entity as dirty
        this.shouldUpdate = true;
        if (this.entityRef) {
          this.entityRef.shouldUpdate = true;
        }
        return true;
      },
    });
  }
}
class PositionComponent extends RayTracingComponent {
  static readonly size = 4;
  static readonly name = "Position" as const;
  static readonly dataclass = Float32Array;

  position: Vector3;

  get data() {
    return this.position.toArray();
  }

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    super();
    this.position = new Vector3(x, y, z);
  }
}

class SphereComponent extends RayTracingComponent {
  static readonly size = 1;
  static readonly name = "Sphere" as const;
  static readonly dataclass = Float32Array;

  radius: number;

  get data() {
    return [this.radius] as const;
  }

  constructor(radius: number = 1.0) {
    super();
    this.radius = radius;
  }
}

const MaterialType = {
  Diffuse: 0,
  Specular: 1,
  Reflective: 2,
} as const;

interface MaterialComponentOptions {
  color?: Vector4;
  type?: (typeof MaterialType)[keyof typeof MaterialType];
  roughness?: number;
  metallic?: number;
  specular?: number;
}

class MaterialComponent extends RayTracingComponent {
  static readonly size = 8;
  static readonly name = "Material" as const;
  static readonly dataclass = Float32Array;

  color: Vector4;
  materialType: (typeof MaterialType)[keyof typeof MaterialType];
  roughness: number;
  metallic: number;
  specular: number;

  get data() {
    return [
      ...this.color.toArray(),
      this.materialType,
      this.roughness,
      this.metallic,
      this.specular,
    ] as const;
  }

  constructor(options: MaterialComponentOptions = {}) {
    super();
    this.color = options.color ?? new Vector4(1, 1, 1, 1);
    this.materialType = options.type ?? MaterialType.Diffuse;
    this.roughness = options.roughness ?? 0.5;
    this.metallic = options.metallic ?? 0.0;
    this.specular = options.specular ?? 0.5;
  }
}

const ComponentMap = {
  [PositionComponent.name]: PositionComponent,
  [SphereComponent.name]: SphereComponent,
  [MaterialComponent.name]: MaterialComponent,
} as const;

const ComponentIds = {
  [PositionComponent.name]: 0,
  [SphereComponent.name]: 1,
  [MaterialComponent.name]: 2,
} as const;

const Components = [
  PositionComponent,
  SphereComponent,
  MaterialComponent,
] as const;

type ComponentName = keyof typeof ComponentMap;
type ComponentType = InstanceType<(typeof Components)[number]>;
type ComponentStorage = {
  -readonly [K in keyof typeof ComponentMap]: {
    instances: Array<InstanceType<(typeof ComponentMap)[K]> | undefined>;
    data: Float32Array | Uint32Array;
    buffer: GPUBuffer;
  };
};

class EntityRegistry {
  device: GPUDevice;
  entityMaxSize = 32;
  entitySize = 0;

  readonly componentSize = Components.length;

  storage: ComponentStorage;

  get totalIndexDataSize() {
    return this.componentSize * this.entityMaxSize;
  }

  entityMetadata = new Uint32Array(
    this.entityMaxSize * this.componentSize,
  ).fill(0);
  entityMetadataBuffer: GPUBuffer;

  entities: Map<number, Entity> = new Map();

  constructor(device: GPUDevice) {
    this.device = device;
    this.storage = Components.reduce((acc, cur) => {
      acc[cur.name] = {
        instances: Array.from<
          InstanceType<(typeof ComponentMap)[ComponentName]>
        >({ length: this.entityMaxSize }) as any,
        data: new cur.dataclass(this.entityMaxSize * cur.size),
        buffer: this.device.createBuffer({
          label: `${cur.name} Buffer`,
          size: cur.size * this.entityMaxSize * cur.dataclass.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        }),
      };
      return acc;
    }, {} as ComponentStorage);
    this.entityMetadataBuffer = this.device.createBuffer({
      label: "Entity Metadata Buffer",
      size: this.totalIndexDataSize * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  spawn(): Entity;
  spawn(components: Array<ComponentType>): Entity;

  spawn(components?: Array<ComponentType>): Entity {
    const id = this.entitySize++;
    const entity = new Entity(id);
    this.entities.set(id, entity);
    if (components) {
      entity.addComponentBundle(components);
    }
    return entity;
  }

  writeBuffer() {
    let anyUpdates = false;
    for (const entity of this.entities.values()) {
      if (!entity.shouldUpdate) continue;
      anyUpdates = true;
      const index = entity.id;
      for (let i = 0; i < this.componentSize; i++) {
        this.entityMetadata[index * this.componentSize + i] = 0;
      }
      for (const [ucomponentName, component] of Object.entries(
        entity.directComponentMap,
      )) {
        const componentName = ucomponentName as ComponentName;
        this.entityMetadata[
          index * this.componentSize + ComponentIds[componentName]
        ] = 1;
        if (component.shouldUpdate) {
          const meta = ComponentMap[componentName];
          const storage = this.storage[componentName];
          const offset = index * meta.size;
          storage.data.set(component.data, offset);
          component.shouldUpdate = false;
        }
      }
      entity.shouldUpdate = false;
    }

    if (anyUpdates) {
      for (const componentName of Components.map((c) => c.name)) {
        const storage = this.storage[componentName];
        this.device.queue.writeBuffer(storage.buffer, 0, storage.data);
      }
      this.device.queue.writeBuffer(
        this.entityMetadataBuffer,
        0,
        this.entityMetadata,
      );
    }
  }

  destroy() {
    for (const storage of Object.values(this.storage)) {
      storage.buffer.destroy();
    }
  }
}

class Entity {
  id: number;
  directComponentMap: {
    -readonly [K in ComponentName]?: InstanceType<(typeof ComponentMap)[K]>;
  } = {};
  shouldUpdate = true;

  constructor(id: number) {
    this.id = id;
  }

  addComponent<T extends ComponentType>(component: T) {
    component.shouldUpdate = true;
    component.entityRef = this;
    const componentName = component.constructor
      .name as keyof typeof ComponentMap;

    if (componentName in this.directComponentMap) {
      throw new Error(
        `Component ${componentName} is already added to this entity.`,
      );
    }

    this.directComponentMap[componentName] = component as any;
    this.shouldUpdate = true;
    return this;
  }

  addComponentBundle(components: Array<ComponentType>): Entity {
    for (const component of components) {
      this.addComponent(component);
    }
    return this;
  }
}
