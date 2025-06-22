import { useScrollDetector } from "@/components/react/scroll-detector";
import { useCallback, useEffect, useRef, useState } from "react";
import { Vector2, Vector3, Vector4 } from "three";

const componentLibrary = /* wgsl */ `
struct Position {
  value: vec3<f32>, // x, y, z,
  _padding: f32, // padding to align to 16 bytes
}

struct Color {
  value: vec4<f32>, // r, g, b, a
}

struct SphereAttribute {
  radius: f32, // radius
}

struct TorusAttribute {
  radius: f32, // radius
  tubeRadius: f32, // tube radius
}

struct EntityMetadata {
  position: u32, 
  color: u32,
  sphere: u32,
  torus: u32,
}

const COMPONENT_ID_POSITION = 0u;
const COMPONENT_ID_COLOR = 1u;
const COMPONENT_ID_SPHERE = 2u;
const COMPONENT_ID_TORUS = 3u;
const COMPONENT_COUNT = 4u;`;

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
  normal: vec3<f32>,
  distance: f32,
  color: vec4<f32>,
  position: vec3<f32>,
  hit: bool,
}
  
struct IntersectionV2 {
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
@group(0) @binding(2) var<uniform> renderMode: u32;
@group(0) @binding(3) var<storage, read> objects: array<Sphere>;
@group(0) @binding(4) var<storage, read> positions: array<Position>;
@group(0) @binding(5) var<storage, read> colors: array<Color>;
@group(0) @binding(6) var<storage, read> spheres: array<SphereAttribute>;
@group(0) @binding(7) var<storage, read> entityMetadata: array<EntityMetadata>;
@group(0) @binding(8) var<storage, read> toruses: array<TorusAttribute>;

const circleCenter = vec3<f32>(0.0, 0.0, 0.0);
const circleRadius = 10.0;
const circleColor = vec4<f32>(0.0, 0.0, 1.0, 1.0); 

const floorBaseColor = vec4<f32>(0.8, 0.8, 0.8, 1.0);
const floorAccentColor = vec4<f32>(0.2, 0.2, 0.2, 1.0);
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
    let ray = generateRay(camera, uv);
    let origin = ray.origin;
    let rayDirection = ray.direction;

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

  if (renderMode >= 2) {
    let ray = generateRay(camera, uv);
    let origin = ray.origin;
    let rayDirection = ray.direction;

    let background = vec4<f32>(0.3, 0.6, 0.8, 1.0);

    var ints = Intersection( 
      vec3<f32>(0.0, 0.0, 0.0), // normal
      1000.0, // distance
      vec4<f32>(0.0, 0.0, 0.0, 1.0), // color
      vec3<f32>(0.0, 0.0, 0.0), // position
      false // hit
    );

    var color: vec4<f32> = vec4<f32>(0.0, 0.0, 0.0, 1.0);

    if (renderMode >= 4 && renderMode < 5) {
      // Floor intersection
      let t = -origin.y / rayDirection.y;
      if (t > 0.0) {
        let position = origin + t * rayDirection;
        let gridX = floor(position.x / floorGridSize);
        let gridY = floor(position.z / floorGridSize);
        let isEven = (gridX + gridY) % 2 == 0;
        if (isEven) {
          color = floorBaseColor;
        } else {
          color = floorAccentColor; 
        }
        ints = Intersection(
          floorNormal,
          t,
          color,
          position,
          true
        );
      }
    }

    for (var i = 0u; i < arrayLength(&objects); i++) {
      let sphere = objects[i];
      let intersection = sphereIntersect(ray, sphere);

      if (intersection.hit && intersection.distance < ints.distance) {
        ints = intersection;
      }
    }

    if (renderMode == 2) {
      if (ints.hit) {
        color = ints.color;
      }
    } else if (renderMode >= 3) {
      if (ints.hit) {
        color = calculateLighting(ints.normal, ints.color);
      }
    }

    if (!ints.hit) {
      color = background;
    }

    imageBuffer[pixel] = color;
  }

  if (renderMode >= 5) {
    let ray = generateRay(camera, uv);
    let origin = ray.origin;
    let rayDirection = ray.direction;

    let background = vec4<f32>(0.3, 0.6, 0.8, 1.0);
    var color: vec4<f32> = background;

    var intersection = IntersectionV2(
      -1.0,
      -1, // no intersection
    );

    let t = -origin.y / rayDirection.y;
    if (t > 0.0) {
      intersection.t = t;
      intersection.e = -2; // -2 means floor intersection (i'm so ready to shoot myself in the foot with this design decision)
    }

    for (var e = 0u; e < arrayLength(&entityMetadata); e++) {
      let eMeta = entityMetadata[e];
      if (eMeta.position == 1u && eMeta.color == 1u) {
        if (eMeta.sphere == 1u) {
          let ni = sphereIntersectV2(ray, i32(e));
          if (ni.t > 0.0 && ((intersection.t > 0.0 && ni.t < intersection.t)
              || intersection.t <= 0.0)) {
            intersection = ni;
          }
        } else if (eMeta.torus == 1u) { 
          let ni = torusIntersect(ray, i32(e));
          if (ni.t > 0.0 && ((intersection.t > 0.0 && ni.t < intersection.t)
              || intersection.t <= 0.0)) {
            intersection = ni;
          }
        }
      }
    }

    if (intersection.t > 0.0) {
      if (intersection.e == -2) {
        color = floorColor(ray, intersection);
      }

      if (intersection.e >= 0) {
        let eu = u32(intersection.e);
        if (entityMetadata[eu].sphere == 1u) {
          color = sphereColor(ray, intersection);
        }
        if (entityMetadata[eu].torus == 1u) {
          color = torusColor(ray, intersection);
        }
      }
    }

    imageBuffer[pixel] = color;
  }
}

fn floorColor(
  ray: Ray,
  intersection: IntersectionV2,
) -> vec4<f32> {
  let position = ray.origin + intersection.t * ray.direction;
  let normal = floorNormal;

  // Calculate the grid color based on the position
  let gridX = floor(position.x / floorGridSize);
  let gridY = floor(position.z / floorGridSize);
  let isEven = (gridX + gridY) % 2 == 0;

  var color: vec4<f32>;
  if (isEven) {
    color = floorBaseColor;
  } else {
    color = floorAccentColor; 
  }

  return calculateLighting(normal, color);
}

fn sphereColor(
  ray: Ray,
  intersection: IntersectionV2,
) -> vec4<f32> {
  let eu = u32(intersection.e);
  let position = positions[eu].value;
  let radius = spheres[eu].radius;
  
  let hitPosition = ray.origin + intersection.t * ray.direction;
  let normal = normalize(hitPosition - position);

  let color = colors[eu].value;
  return calculateLighting(normal, color);
}

fn torusColor(  
  ray: Ray,
  intersection: IntersectionV2,
) -> vec4<f32> {
  let eu = u32(intersection.e);
  let position = positions[eu].value;
  let radius = toruses[eu].radius;
  let tubeRadius = toruses[eu].tubeRadius;

  let hitPosition = ray.origin + intersection.t * ray.direction;
  let normal = normalize(hitPosition - position);

  let color = colors[eu].value;
  
  return calculateLighting(normal, color);
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

fn sphereIntersectV2(
  ray: Ray,
  e: i32,
) -> IntersectionV2 {
  let eu = u32(e);
  let center = positions[eu].value;
  let radius = spheres[eu].radius;
  let oc = center - ray.origin;
  let a = dot(oc, ray.direction);
  let b = dot(oc, oc) - a * a - radius * radius;
  var intersection = IntersectionV2(-1.0, e); // no intersection

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

fn torusIntersect(
  ray: Ray, 
  e: i32,
) -> IntersectionV2 {
  let eu = u32(e);

  let position = positions[eu].value;
  let radius = toruses[eu].radius;
  let tubeRadius = toruses[eu].tubeRadius;

  let oc = ray.origin - position;
  let a = dot(ray.direction, ray.direction);
  let b = dot(oc, ray.direction);
  let c = dot(oc, oc) - radius * radius - tubeRadius * tubeRadius;
  let discriminant = b * b - a * c;
  var intersection = IntersectionV2(-1.0, e); // no intersection

  if (discriminant > 0.0) {
    let t1 = (-b - sqrt(discriminant)) / a;
    let t2 = (-b + sqrt(discriminant)) / a;

    if (t1 > 0.0 || t2 > 0.0) {
      intersection.t = min(t1, t2);
      intersection.e = e;
    }
  }

  return intersection;
}

fn sphereIntersect(
  ray: Ray,
  sphere: Sphere,
) -> Intersection {
  let oc = sphere.center - ray.origin;
  let a = dot(oc, ray.direction);
  let b = dot(oc, oc) - a * a - sphere.radius * sphere.radius;
  var hit = false;
  var distance = 0.0;
  var position = vec3<f32>(0.0, 0.0, 0.0);
  var normal = vec3<f32>(0.0, 0.0, 0.0); 

  if (b < 0.0 && a > 0.0) {
    hit = true;
    let d = sqrt(sphere.radius * sphere.radius - b);
    let t0 = a - d; // near intersection
    let t1 = a + d; // far intersection
    if (t0 < 0.0 && t1 < 0.0) {
      hit = false; // we are behind the sphere
    } else if (t0 < 0.0) {
      distance = t1; // we are behind the near intersection, take the far one
    } else {
      distance = t0; // we found a closer intersection
    }
    position = ray.origin + distance * ray.direction;
    normal = normalize(position - sphere.center);
  }

  return Intersection(normal, distance, sphere.color, position, hit);
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
  let viewport = vec2<u32>(camera.viewport);
  let x = u32(f32(uv.x) * camera.viewport.x);
  let y = u32(f32(uv.y) * camera.viewport.y);
  let index = clamp(x + y * viewport.x, 0u, viewport.x * viewport.y - 1u);
  return imageBuffer[index];
}
`;

type System = (rd: RayTracingRenderer) => void;

const TUBE_RADIUS = 5.0;

const toruses = Array.from({ length: 7 }, (_, i) => ({
  position: new Vector3(0, TUBE_RADIUS * 2 * i + TUBE_RADIUS, 0),
  radius: 20.0,
  tubeRadius: TUBE_RADIUS,
  color: new Vector4(Math.random(), Math.random(), Math.random(), 1.0),
}));

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

  const stateRef = useRef<{
    angle: number;
    spawnedSpheres: Entity[];
    toruses: Entity[];
  }>({
    angle: 0,
    spawnedSpheres: [],
    toruses: [],
  });

  const jumpingUpandDown: System = (rd) => {
    if (!scrollPassed("ecs-component")) {
      return;
    }

    const state = stateRef.current;

    if (state.angle >= 360) {
      state.angle = 0;
    } else {
      state.angle += 0.1;
    }

    const data =
      rd.state.entityRegistry.entities.get(0)?.directComponentMap.Position;
    if (data) {
      data.y = Math.sin(state.angle) * 10 + 10;
    }

    const data2 =
      rd.state.entityRegistry.entities.get(1)?.directComponentMap.Position;
    if (data2) {
      data2.z = Math.sin(state.angle + Math.PI) * 10;
    }
  };

  const initRayTracing = useCallback(
    async (canvas: HTMLCanvasElement) => {
      if (!rendererRef.current) {
        rendererRef.current = new RayTracingRenderer(canvas, scrollPassed);
        rendererRef.current.systems.push(jumpingUpandDown);
      }
      const renderer = rendererRef.current;
      if (!renderer.isInitialized()) {
        try {
          await renderer.init();

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
  DIFFUSE_LIGHTING: 3,
  FLOOR: 4,
  ECS: 5,
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
    position: Vector3 = new Vector3(0, 20, 100),
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
  entityRegistry: EntityRegistry;

  constructor(canvas: HTMLCanvasElement, device: GPUDevice) {
    this.imageBuffer = new ImageBuffer(device, canvas.width, canvas.height);
    this.camera = new Camera(device, [canvas.width, canvas.height]);
    this.renderMode = new RenderMode(device);
    this.objects = new SceneObjectState(device, [
      new Sphere(new Vector3(0, 10, 0), 10, new Vector4(0.8, 0.8, 0.3, 1.0)),
      new Sphere(new Vector3(15, 15, 5), 15, new Vector4(0.8, 0.3, 0.8, 1.0)),
      new Sphere(new Vector3(-20, 12, 0), 12, new Vector4(0.3, 0.3, 0.8, 1.0)),
    ]);
    this.entityRegistry = new EntityRegistry(device);
    this.entityRegistry.spawn([
      new PositionComponent(0, 10, 0),
      new ColorComponent(0.8, 0.8, 0.3, 1.0),
      new SphereComponent(10),
    ]);
    this.entityRegistry.spawn([
      new PositionComponent(15, 15, 5),
      new ColorComponent(0.8, 0.3, 0.8, 1.0),
      new SphereComponent(15),
    ]);
    this.entityRegistry.spawn([
      new PositionComponent(-20, 12, 0),
      new ColorComponent(0.3, 0.3, 0.8, 1.0),
      new SphereComponent(12),
    ]);
  }

  setFromCanvas(canvas: HTMLCanvasElement) {
    this.imageBuffer.set(canvas.width, canvas.height);
    this.camera.viewport.set(canvas.width, canvas.height);
  }

  setRenderMode(mode: RenderModeType) {
    this.renderMode.mode = mode;
  }

  destroy() {
    this.imageBuffer.destroy();
    this.camera.destroy();
    this.renderMode.destroy();
    this.objects.destroy();
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
          {
            binding: 4,
            resource: {
              buffer: this.state.entityRegistry.storage.Position.buffer,
            },
          },
          {
            binding: 5,
            resource: {
              buffer: this.state.entityRegistry.storage.Color.buffer,
            },
          },
          {
            binding: 6,
            resource: {
              buffer: this.state.entityRegistry.storage.Sphere.buffer,
            },
          },
          {
            binding: 7,
            resource: {
              buffer: this.state.entityRegistry.entityMetadataBuffer,
            },
          },
          {
            binding: 8,
            resource: {
              buffer: this.state.entityRegistry.storage.Torus.buffer,
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
      if (!this.scrollPassed("diffuse-lighting")) {
        this.state.setRenderMode("MULTIPLE_BALLS");
      } else {
        if (!this.scrollPassed("floor")) {
          this.state.setRenderMode("DIFFUSE_LIGHTING");
        } else {
          if (!this.scrollPassed("ecs-component")) {
            this.state.setRenderMode("FLOOR");
          } else {
            this.state.setRenderMode("ECS");
          }
        }
      }
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

  systems: System[] = [];

  update() {
    for (const system of this.systems) {
      system(this);
    }
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

interface RayTracingComponent {
  entityRef: Entity | null;
  shouldUpdate: boolean;
  data: ReadonlyArray<number>;
}

class PositionComponent extends Vector3 implements RayTracingComponent {
  static readonly size = 4;
  static readonly name = "Position" as const;
  static readonly dataclass = Float32Array;

  entityRef: Entity | null = null;
  shouldUpdate = true;

  get data() {
    return this.toArray();
  }

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    super(x, y, z);
    return new Proxy(this, {
      get: (target, prop) => {
        return (target as any)[prop];
      },
      set: (target, prop, value) => {
        (target as any).shouldUpdate = true;
        (target as any)[prop] = value;
        if ((target as any).entityRef) {
          (target as any).entityRef.shouldUpdate = true;
        }
        return true;
      },
    });
  }
}

class ColorComponent extends Vector4 {
  static readonly size = 4;
  static readonly name = "Color" as const;
  static readonly dataclass = Float32Array;

  entityRef: Entity | null = null;

  shouldUpdate = true;

  get data() {
    return this.toArray();
  }

  constructor(
    r: number = 1.0,
    g: number = 1.0,
    b: number = 1.0,
    a: number = 1.0,
  ) {
    super(r, g, b, a);
    return new Proxy(this, {
      get: (target, prop) => {
        return (target as any)[prop];
      },
      set: (target, prop, value) => {
        (target as any).shouldUpdate = true;
        (target as any)[prop] = value;
        if ((target as any).entityRef) {
          (target as any).entityRef.shouldUpdate = true;
        }
        return true;
      },
    });
  }
}

class SphereComponent {
  static readonly size = 1; // Sphere radius
  static readonly name = "Sphere" as const;
  static readonly dataclass = Float32Array;
  entityRef: Entity | null = null;

  shouldUpdate = true;
  radius: number;

  get data() {
    return [this.radius] as const;
  }

  constructor(radius: number = 1.0) {
    this.radius = radius;
    return new Proxy(this, {
      get: (target, prop) => {
        return (target as any)[prop];
      },
      set: (target, prop, value) => {
        (target as any).shouldUpdate = true;
        (target as any)[prop] = value;
        if ((target as any).entityRef) {
          (target as any).entityRef.shouldUpdate = true;
        }
        return true;
      },
    });
  }
}

class TorusComponent implements RayTracingComponent {
  static readonly size = 2; // Torus radius and tube radius
  static readonly name = "Torus" as const;
  static readonly dataclass = Float32Array;

  entityRef: Entity | null = null;
  shouldUpdate = true;
  radius: number;
  tubeRadius: number;

  get data() {
    return [this.radius, this.tubeRadius] as const;
  }

  constructor(radius: number = 1.0, tubeRadius: number = 0.5) {
    this.radius = radius;
    this.tubeRadius = tubeRadius;
    return new Proxy(this, {
      get: (target, prop) => {
        return (target as any)[prop];
      },
      set: (target, prop, value) => {
        (target as any).shouldUpdate = true;
        (target as any)[prop] = value;
        if ((target as any).entityRef) {
          (target as any).entityRef.shouldUpdate = true;
        }
        return true;
      },
    });
  }
}

const ComponentMap = {
  [PositionComponent.name]: PositionComponent,
  [ColorComponent.name]: ColorComponent,
  [SphereComponent.name]: SphereComponent,
  [TorusComponent.name]: TorusComponent,
} as const;

const ComponentIds = {
  [PositionComponent.name]: 0,
  [ColorComponent.name]: 1,
  [SphereComponent.name]: 2,
  [TorusComponent.name]: 3,
} as const;

const Components = [
  PositionComponent,
  ColorComponent,
  SphereComponent,
  TorusComponent,
] as const;

type ComponentName = keyof typeof ComponentMap;
type ComponentType = InstanceType<(typeof Components)[number]>;
type ComponentStorage = {
  -readonly [K in keyof typeof ComponentMap as (typeof ComponentMap)[K]["name"]]: {
    instances: Array<InstanceType<(typeof ComponentMap)[K]>>;
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
        instances: Array.from({
          length: this.entityMaxSize,
        }) as any,
        data: new cur.dataclass(
          this.entityMaxSize * cur.dataclass.BYTES_PER_ELEMENT,
        ),
        buffer: this.device.createBuffer({
          label: `${cur.name} Buffer`,
          size: cur.dataclass.BYTES_PER_ELEMENT * this.entityMaxSize,
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
    for (const entity of this.entities.values()) {
      if (!entity.shouldUpdate) {
        continue;
      }
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
          this.device.queue.writeBuffer(
            storage.buffer,
            offset * meta.dataclass.BYTES_PER_ELEMENT,
            storage.data,
            offset,
            meta.size,
          );
          component.shouldUpdate = false;
        }
      }
      entity.shouldUpdate = false;
    }

    this.device.queue.writeBuffer(
      this.entityMetadataBuffer,
      0,
      this.entityMetadata,
      0,
      this.totalIndexDataSize,
    );
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
