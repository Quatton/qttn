import { useEffect, useRef, type RefObject } from "react";
import * as glm from "gl-matrix";
import { useScrollDetector } from "@/components/react/scroll-detector";

const curveVs = `#version 300 es

in vec2 a_position;
uniform mat4 u_scaleMatrix;

void main() {
    gl_Position = u_scaleMatrix * vec4(a_position, 0.0, 1.0);
}
`;

const curveFs = `#version 300 es

precision mediump float;
out vec4 fragColor;
uniform vec4 u_color;

void main() {
    fragColor = u_color;
}
`;

const gridVs = `#version 300 es

in vec2 a_position;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const gridFs = `#version 300 es

precision mediump float;
uniform vec4 u_color;
uniform vec2 u_pitch;
uniform vec2 u_resolution;

out vec4 fragColor;

void main() {
  vec2 scaledPitch = u_pitch;
  vec2 coord = gl_FragCoord.xy - (u_resolution * 0.5);
  if (mod(coord.x, scaledPitch.x) < 1. || mod(coord.y, scaledPitch.y) < 1.) {
    fragColor = u_color;
  } else {
    fragColor = vec4(0.);  
  }
}`;

const pointVs = `#version 300 es
in vec2 a_position;
uniform mat4 u_scaleMatrix;

void main() {
    gl_Position = u_scaleMatrix * vec4(a_position, 0.0, 1.0);
    gl_PointSize = 8.0;
}
`;

const pointFs = `#version 300 es
precision mediump float;
out vec4 fragColor;
uniform vec4 u_color;

void main() {
    // Calculate the distance from the center of the point
    float dist = length(gl_PointCoord - vec2(0.5, 0.5));
    // Set the color based on the distance
    if (dist < 0.5) {
        fragColor = u_color;
    } else {
        discard; // Discard fragments outside the circle
    }
}
`;

const PITCH = 50; // 1 world unit = 50 pixels

type MouseState = {
  x: number;
  y: number;
  isDown: boolean;
  picked: number | undefined;
  intersect: number | undefined;
  selected: number | undefined;
  shouldSnap: boolean;
  isDragging: boolean;
  intersectLine: number | undefined;
  intersectSegment: number | undefined;
  selectedLine: number | undefined;
  ticks: number;
};

class Vertex {
  coords: [number, number];
  isControlPoint: boolean;
  relatedLines: Set<number>;

  constructor(coords: [number, number], isControlPoint = false) {
    this.coords = coords;
    this.isControlPoint = isControlPoint;
    this.relatedLines = new Set<number>();
  }

  isNear(point: [number, number], threshold: number): boolean {
    return glm.vec2.distance(this.coords, point) < threshold;
  }
}

class Line {
  allVerticesRef: RefObject<VertexMap>;
  vertices: number[];
  cached: [number, number][] | undefined;

  constructor(vertices: number[], allVerticesRef: RefObject<VertexMap>) {
    this.vertices = vertices;
    this.allVerticesRef = allVerticesRef;
  }

  start(): number {
    return this.vertices[0];
  }

  end(): number {
    return this.vertices[this.vertices.length - 1];
  }

  addVertex(id: number) {
    this.vertices.splice(1, 0, id);
    this?.invalidate();
  }

  addVertexAtIndex(id: number, index: number) {
    this.vertices.splice(index, 0, id);
    this?.invalidate();
  }

  nearestSegmentIndex(
    point: [number, number],
    threshold: number,
    vertexMap: VertexMap,
  ): number {
    // let minDistance = Math.in;
    let nearestIndex = -1;

    for (let i = 0; i < this.vertices.length; i++) {
      const start = vertexMap.get(this.vertices[i])?.coords;
      const end = vertexMap.get(
        this.vertices[(i + 1) % this.vertices.length],
      )?.coords;
      if (start && end) {
        const distance = distanceFromLineAB(point, start, end);
        if (distance < threshold) {
          // minDistance = distance;
          nearestIndex = i;
          break;
        }
      }
    }

    return nearestIndex;
  }

  isNear(
    point: [number, number],
    threshold: number,
    vertexMap: VertexMap,
  ): boolean {
    return this.nearestSegmentIndex(point, threshold, vertexMap) !== -1;
  }

  getOrCompute() {
    if (this.cached) {
      return this.cached;
    }
    const computed = this.compute();
    this.cached = computed;
    return computed;
  }

  compute(): [number, number][] {
    const v = this.allVerticesRef.current;

    const vec = this.vertices.map((s) =>
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      glm.vec2.fromValues(...v.get(s)!.coords),
    );

    if (vec.length === 2) {
      return vec.map((v) => [v[0], v[1]]) as [number, number][];
    }

    const T = 100;
    const N = vec.length - 1;
    const ts = linspace(0, 1, T);

    const result = ts.map((t) => {
      const res = glm.vec2.create();
      for (let i = 0; i <= N; i++) {
        const coefficient = comb(N, i) * t ** i * (1 - t) ** (N - i);
        glm.vec2.scaleAndAdd(res, res, vec[i], coefficient);
      }
      return [res[0], res[1]];
    });

    return result as [number, number][];
  }

  invalidate() {
    this.cached = undefined;
  }
}

class VertexMap {
  items: Map<number, Vertex>;
  nextId: number;

  constructor() {
    this.items = new Map();
    this.nextId = 0;
  }

  add(coords: [number, number], isControlPoint = false): number {
    const id = this.nextId++;
    this.items.set(id, new Vertex(coords, isControlPoint));
    return id;
  }

  delete(id: number, lineMap: LineMap) {
    const vertex = this.items.get(id);
    if (vertex) {
      // For each related line
      for (const lineId of vertex.relatedLines) {
        if (vertex.isControlPoint) {
          const line = lineMap.items.get(lineId);
          if (line) {
            const index = line.vertices.indexOf(id);
            if (index > -1) {
              line.vertices.splice(index, 1);
              line.invalidate();
            }
          }
        } else {
          lineMap.items.delete(lineId);
        }
      }
      this.items.delete(id);
    }
  }

  get(id: number): Vertex | undefined {
    return this.items.get(id);
  }

  set(id: number, vertex: Vertex) {
    this.items.set(id, vertex);
  }

  entries() {
    return this.items.entries();
  }

  get size() {
    return this.items.size;
  }
}

class LineMap {
  allVerticesRef: RefObject<VertexMap>;
  items: Map<number, Line>;
  nextId: number;

  constructor(allVerticesRef: RefObject<VertexMap>) {
    this.items = new Map();
    this.nextId = 0;
    this.allVerticesRef = allVerticesRef;
  }

  add(vertices: number[]): number {
    const id = this.nextId++;
    this.items.set(id, new Line(vertices, this.allVerticesRef));
    return id;
  }

  delete(id: number) {
    this.items.delete(id);
  }

  get(id: number): Line | undefined {
    return this.items.get(id);
  }

  set(id: number, line: Line) {
    this.items.set(id, line);
  }

  entries() {
    return this.items.entries();
  }

  get size() {
    return this.items.size;
  }
}

export function SimpleCurve() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scrollPassed } = useScrollDetector();
  const vertices = useRef<VertexMap>(new VertexMap());
  const lines = useRef<LineMap>(new LineMap(vertices));
  const draggingTimer = useRef<NodeJS.Timeout | null>(null);

  const mouseState = useRef<MouseState>({
    x: 0,
    y: 0,
    isDown: false,
    intersect: undefined,
    picked: undefined,
    selected: undefined,
    shouldSnap: false,
    isDragging: false,
    intersectLine: undefined,
    intersectSegment: undefined,
    selectedLine: undefined,
    ticks: 0,
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctrl = new AbortController();

    canvasRef.current.addEventListener("mousedown", mouseDownHandler, {
      signal: ctrl.signal,
    });

    canvasRef.current.addEventListener("mousemove", mouseMoveHandler, {
      signal: ctrl.signal,
    });

    canvasRef.current.addEventListener("mouseup", mouseUpHandler, {
      signal: ctrl.signal,
    });

    window.addEventListener("keydown", keydownHandler, {
      signal: ctrl.signal,
    });

    window.addEventListener("keyup", keyupHandler, {
      signal: ctrl.signal,
    });

    main(ctrl);

    return () => {
      cleanup();
      ctrl.abort();
    };
  }, []);

  function keydownHandler(e: KeyboardEvent) {
    if (e.key === "Escape") {
      mouseState.current.selected = undefined;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (mouseState.current.selected !== undefined) {
        vertices.current.delete(mouseState.current.selected, lines.current);
        mouseState.current.selected = undefined;
      }
    }
    if (e.shiftKey) {
      mouseState.current.shouldSnap = true;
    }
  }

  function keyupHandler(_e: KeyboardEvent) {
    mouseState.current.shouldSnap = false;
  }

  function mouseDownHandler(_e: MouseEvent) {
    if (!canvasRef.current) return;

    if (mouseState.current.selected !== undefined) {
      const selectedVertex = vertices.current.get(mouseState.current.selected);
      if (selectedVertex?.isControlPoint) {
        mouseState.current.selected = undefined;
        return;
      }
      let id: number;
      if (mouseState.current.intersect !== undefined) {
        id = mouseState.current.intersect;
      } else {
        id = vertices.current.add([mouseState.current.x, mouseState.current.y]);
      }
      const lineId = lines.current.add([mouseState.current.selected, id]);

      const startVertex = vertices.current.get(mouseState.current.selected);
      if (startVertex) {
        startVertex.relatedLines.add(lineId);
        vertices.current.set(mouseState.current.selected, startVertex);
      }

      const endVertex = vertices.current.get(id);
      if (endVertex) {
        endVertex.relatedLines.add(lineId);
        vertices.current.set(id, endVertex);
      }

      mouseState.current.selected = id;
      return;
    }

    if (mouseState.current.intersectLine !== undefined) {
      const line = lines.current.get(mouseState.current.intersectLine);
      const segment = mouseState.current.intersectSegment;
      if (
        line &&
        segment !== undefined &&
        segment >= 0 &&
        segment < line.vertices.length - 1
      ) {
        const id = vertices.current.add(
          [mouseState.current.x, mouseState.current.y],
          true,
        );
        const vertex = vertices.current.get(id);
        vertex?.relatedLines.add(mouseState.current.intersectLine);
        line.addVertexAtIndex(id, segment + 1);
        mouseState.current.selected = undefined;
        return;
      }
    }

    if (mouseState.current.intersect !== undefined) {
      mouseState.current.picked = mouseState.current.intersect;
      return;
    }

    if (
      mouseState.current.picked === undefined &&
      mouseState.current.intersect === undefined
    ) {
      if (mouseState.current.selected !== undefined) {
        mouseState.current.selected = undefined;
        return;
      }
      mouseState.current.ticks++;
      const id = vertices.current.add([
        mouseState.current.x,
        mouseState.current.y,
      ]);

      mouseState.current.selected = id;
      return;
    }
  }

  function mouseUpHandler(_e: MouseEvent) {
    mouseState.current.isDown = false;

    if (
      mouseState.current.intersect !== undefined &&
      !mouseState.current.isDragging
    ) {
      mouseState.current.selected = mouseState.current.intersect;
    }

    if (draggingTimer.current) {
      clearTimeout(draggingTimer.current);
      draggingTimer.current = null;
    }

    mouseState.current.picked = undefined;
    mouseState.current.ticks = 0;
    mouseState.current.isDragging = false;
  }

  function mouseMoveHandler(e: MouseEvent) {
    if (!canvasRef.current) return;
    const [worldX, worldY] = screenToWorld(
      e.clientX,
      e.clientY,
      canvasRef.current,
      PITCH,
    );

    if (mouseState.current.shouldSnap) {
      const x = Math.round(worldX);
      const y = Math.round(worldY);
      mouseState.current.x = x;
      mouseState.current.y = y;
    } else {
      mouseState.current.x = worldX;
      mouseState.current.y = worldY;
    }

    mouseState.current.isDown = e.buttons === 1;
    mouseState.current.intersect = undefined;
    mouseState.current.intersectLine = undefined;
    mouseState.current.intersectSegment = undefined;

    for (const [idx, vertex] of vertices.current.entries()) {
      if (vertex.isNear([worldX, worldY], 0.2)) {
        mouseState.current.intersect = idx;
        break;
      }
    }

    if (mouseState.current.intersect === undefined) {
      for (const [idx, line] of lines.current.entries()) {
        const segmentIndex = line.nearestSegmentIndex(
          [worldX, worldY],
          0.2,
          vertices.current,
        );

        if (segmentIndex >= 0) {
          mouseState.current.intersectLine = idx;
          mouseState.current.intersectSegment = segmentIndex;
          break;
        }
      }
    }

    if (mouseState.current.picked !== undefined && mouseState.current.isDown) {
      if (!mouseState.current.isDragging && !draggingTimer.current) {
        draggingTimer.current = setTimeout(() => {
          mouseState.current.isDragging = true;
          draggingTimer.current = null;
        }, 50);
      }

      if (mouseState.current.isDragging) {
        const pickedVertex = vertices.current.get(mouseState.current.picked);
        if (!pickedVertex) return;
        pickedVertex.coords = [mouseState.current.x, mouseState.current.y];
        for (const lineIdx of pickedVertex.relatedLines) {
          const line = lines.current.get(lineIdx);
          line?.invalidate();
        }
      }
    } else if (draggingTimer.current) {
      clearTimeout(draggingTimer.current);
      draggingTimer.current = null;
    }
  }

  async function cleanup() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2");
    if (!gl) return;

    const programs = gl.getParameter(gl.CURRENT_PROGRAM);
    if (programs) {
      gl.deleteProgram(programs);
    }

    const buffers = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
    if (buffers) {
      gl.deleteBuffer(buffers);
    }

    // Clear the canvas
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  async function main(controller: AbortController) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2");

    if (gl === null) {
      alert(
        "Unable to initialize WebGL. Your browser or machine may not support it.",
      );
      return;
    }

    const curveVertexShader = compileShader(gl, gl.VERTEX_SHADER, curveVs);
    const curveFragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, curveFs);

    if (!curveVertexShader || !curveFragmentShader) {
      console.error("Failed to create curve shaders");
      return;
    }

    const curveProgram = createProgram(
      gl,
      curveVertexShader,
      curveFragmentShader,
    );
    if (!curveProgram) {
      console.error("Failed to create curve program");
      return;
    }

    const uColorLoc_curve = gl.getUniformLocation(curveProgram, "u_color");
    const uScaleMatrixLoc_curve = gl.getUniformLocation(
      curveProgram,
      "u_scaleMatrix",
    );

    const axisLines = [-1.0, 0, 1.0, 0, 0, -1.0, 0, 1.0];
    const circle = linspace(0, 2 * Math.PI, 100).flatMap((theta) => [
      4.0 * Math.cos(theta),
      4.0 * Math.sin(theta),
    ]);

    const MAX_CURVE_VERTICES = 10000;

    gl.useProgram(curveProgram);
    const curveBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, curveBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(MAX_CURVE_VERTICES),
      gl.STATIC_DRAW,
    );

    const curvePosLocation = gl.getAttribLocation(curveProgram, "a_position");
    gl.enableVertexAttribArray(curvePosLocation);
    gl.vertexAttribPointer(curvePosLocation, 2, gl.FLOAT, false, 0, 0);

    const gridVertexShader = compileShader(gl, gl.VERTEX_SHADER, gridVs);
    const gridFragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, gridFs);

    if (!gridVertexShader || !gridFragmentShader) {
      console.error("Failed to create grid shaders");
      return;
    }

    const gridProgram = createProgram(gl, gridVertexShader, gridFragmentShader);
    if (!gridProgram) {
      console.error("Failed to create grid program");
      return;
    }

    const uColorLoc_grid = gl.getUniformLocation(gridProgram, "u_color");
    const uPitchLoc = gl.getUniformLocation(gridProgram, "u_pitch");
    const uResolutionLoc = gl.getUniformLocation(gridProgram, "u_resolution");
    const gridPosLocation = gl.getAttribLocation(gridProgram, "a_position");

    const gridBuffer = gl.createBuffer();
    const gridIndexBuffer = gl.createBuffer();

    // Grid vertex positions for a full-screen quad
    const positions = [-1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0];
    const indices = [0, 1, 2, 0, 2, 3];

    // Set up grid buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gridIndexBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW,
    );

    const pointVertexShader = compileShader(gl, gl.VERTEX_SHADER, pointVs);
    const pointFragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, pointFs);
    if (!pointVertexShader || !pointFragmentShader) {
      console.error("Failed to create point shaders");
      return;
    }
    const pointProgram = createProgram(
      gl,
      pointVertexShader,
      pointFragmentShader,
    );
    if (!pointProgram) {
      console.error("Failed to create point program");
      return;
    }
    const uColorLoc_point = gl.getUniformLocation(pointProgram, "u_color");
    const pointPosLocation = gl.getAttribLocation(pointProgram, "a_position");
    const uScaleMatrixLoc_point = gl.getUniformLocation(
      pointProgram,
      "u_scaleMatrix",
    );

    const MAX_POINTS = 1000;
    const pointBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(MAX_POINTS * 2),
      gl.DYNAMIC_DRAW, // <- Use DYNAMIC_DRAW for dynamic data
    );

    const iden = glm.mat4.create();
    glm.mat4.identity(iden);

    const render = () => {
      if (!canvasRef.current) return;
      if (controller.signal.aborted) return;

      resizeCanvasToDisplaySize(canvas);
      const displayWidth = gl.canvas.width;
      const displayHeight = gl.canvas.height;
      gl.viewport(0, 0, displayWidth, displayHeight);

      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const aspectRatio = displayWidth / displayHeight;
      const worldToGLScale = (PITCH * 2) / displayWidth;

      const aspectScaleMatrix = glm.mat4.create();
      glm.mat4.identity(aspectScaleMatrix);
      glm.mat4.scale(aspectScaleMatrix, aspectScaleMatrix, [
        worldToGLScale,
        worldToGLScale * aspectRatio,
        1,
      ]);

      // Draw grid
      gl.useProgram(gridProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gridIndexBuffer);
      gl.enableVertexAttribArray(gridPosLocation);
      gl.vertexAttribPointer(gridPosLocation, 2, gl.FLOAT, false, 0, 0);
      gl.uniform4f(uColorLoc_grid, 0.2, 0.2, 0.2, 1.0);

      gl.uniform2fv(uPitchLoc, [PITCH, PITCH]);
      gl.uniform2fv(uResolutionLoc, [displayWidth, displayHeight]);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

      if (scrollPassed("show-axes")) {
        gl.useProgram(curveProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, curveBuffer);
        gl.enableVertexAttribArray(curvePosLocation);
        gl.vertexAttribPointer(curvePosLocation, 2, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(uScaleMatrixLoc_curve, false, iden);
        gl.uniform4f(uColorLoc_curve, 0.4, 0.0, 0.0, 1.0);

        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(axisLines),
          gl.STATIC_DRAW,
        );
        gl.drawArrays(gl.LINES, 0, 4);
      }

      if (scrollPassed("show-circle") && !scrollPassed("show-points")) {
        gl.useProgram(curveProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, curveBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(circle),
          gl.STATIC_DRAW,
        );
        gl.enableVertexAttribArray(curvePosLocation);
        gl.vertexAttribPointer(curvePosLocation, 2, gl.FLOAT, false, 0, 0);
        gl.uniform4f(uColorLoc_curve, 0.0, 0.4, 0.0, 1.0);
        gl.uniformMatrix4fv(uScaleMatrixLoc_curve, false, aspectScaleMatrix);
        gl.drawArrays(gl.LINE_LOOP, 0, circle.length / 2);
      }

      if (scrollPassed("show-points")) {
        gl.useProgram(pointProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
        gl.enableVertexAttribArray(pointPosLocation);
        gl.vertexAttribPointer(pointPosLocation, 2, gl.FLOAT, false, 0, 0);
        gl.uniform4f(uColorLoc_point, 0.0, 0.0, 0.4, 1.0);

        if (vertices.current.size > 0) {
          const vertexArray = Array.from(vertices.current.entries()).flatMap(
            ([_, vertex]) => [vertex.coords[0], vertex.coords[1]],
          );
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(vertexArray));
        }

        gl.uniformMatrix4fv(uScaleMatrixLoc_point, false, aspectScaleMatrix);
        gl.drawArrays(gl.POINTS, 0, vertices.current.size);

        if (mouseState.current.intersect !== undefined) {
          const pickedupVertex = vertices.current.get(
            mouseState.current.intersect,
          );
          if (pickedupVertex) {
            gl.uniform4f(uColorLoc_point, 1.0, 0.0, 0.0, 1.0);
            gl.bufferSubData(
              gl.ARRAY_BUFFER,
              0,
              new Float32Array(pickedupVertex.coords),
            );
            gl.drawArrays(gl.POINTS, 0, 1);
          }
        }

        if (
          mouseState.current.isDown &&
          mouseState.current.intersect !== undefined
        ) {
          const selectedVertex = vertices.current.get(
            mouseState.current.intersect,
          );
          if (selectedVertex) {
            gl.uniform4f(uColorLoc_point, 0.0, 0.7, 0.0, 1.0);
            gl.bufferSubData(
              gl.ARRAY_BUFFER,
              0,
              new Float32Array(selectedVertex.coords),
            );
            gl.drawArrays(gl.POINTS, 0, 1);
          }
        }

        if (mouseState.current.selected !== undefined) {
          const selectedVertex = vertices.current.get(
            mouseState.current.selected,
          );
          if (selectedVertex) {
            gl.uniform4f(uColorLoc_point, 0.7, 0.7, 0.0, 1.0);
            gl.bufferSubData(
              gl.ARRAY_BUFFER,
              0,
              new Float32Array(selectedVertex.coords),
            );
            gl.drawArrays(gl.POINTS, 0, 1);
          }
        }

        if (
          mouseState.current.picked === undefined &&
          mouseState.current.selected === undefined &&
          mouseState.current.intersect === undefined
        ) {
          gl.uniform4f(uColorLoc_point, 0.0, 0.0, 0.4, 0.5);
          gl.bufferSubData(
            gl.ARRAY_BUFFER,
            0,
            new Float32Array([mouseState.current.x, mouseState.current.y]),
          );
          gl.drawArrays(gl.POINTS, 0, 1);
        }
      }

      if (scrollPassed("show-line")) {
        gl.useProgram(curveProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, curveBuffer);
        gl.enableVertexAttribArray(curvePosLocation);
        gl.vertexAttribPointer(curvePosLocation, 2, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(uScaleMatrixLoc_curve, false, aspectScaleMatrix);

        // Draw preview line for selected vertex
        if (mouseState.current.selected !== undefined) {
          const selectedVertex = vertices.current.get(
            mouseState.current.selected,
          );
          if (selectedVertex?.isControlPoint === false) {
            const lineVertices = [
              selectedVertex.coords[0],
              selectedVertex.coords[1],
              ...(mouseState.current.intersect !== undefined
                ? (vertices.current.get(mouseState.current.intersect)
                    ?.coords ?? [mouseState.current.x, mouseState.current.y])
                : [mouseState.current.x, mouseState.current.y]),
            ];

            gl.uniform4f(uColorLoc_curve, 0.0, 0.4, 0.0, 1.0);
            gl.bufferSubData(
              gl.ARRAY_BUFFER,
              0,
              new Float32Array(lineVertices),
            );
            gl.drawArrays(gl.LINES, 0, lineVertices.length / 2);
          }
        }

        // Draw all existing lines
        if (lines.current.size > 0) {
          // Create arrays for main lines and segmented lines
          const mainLines: number[] = [];
          const segmentedLines: number[] = [];

          for (const [_, line] of lines.current.entries()) {
            const lineVertices = line.vertices;
            const start = vertices.current.get(line.start())?.coords;
            const end = vertices.current.get(line.end())?.coords;
            if (!start || !end) continue;
            mainLines.push(start[0], start[1], end[0], end[1]);

            if (lineVertices.length > 2) {
              for (let i = 0; i < lineVertices.length - 1; i++) {
                const start = vertices.current.get(lineVertices[i])?.coords;
                const end = vertices.current.get(lineVertices[i + 1])?.coords;
                if (!start || !end) continue;

                segmentedLines.push(start[0], start[1], end[0], end[1]);
              }
            }
          }

          if (mainLines.length > 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, curveBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array(mainLines),
              gl.STATIC_DRAW,
            );
            gl.enableVertexAttribArray(curvePosLocation);
            gl.vertexAttribPointer(curvePosLocation, 2, gl.FLOAT, false, 0, 0);
            gl.uniform4f(uColorLoc_curve, 0.0, 0.0, 0.7, 1.0);
            gl.drawArrays(gl.LINES, 0, mainLines.length / 2);
          }

          if (segmentedLines.length > 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, curveBuffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array(segmentedLines),
              gl.STATIC_DRAW,
            );
            gl.enableVertexAttribArray(curvePosLocation);
            gl.vertexAttribPointer(curvePosLocation, 2, gl.FLOAT, false, 0, 0);
            gl.uniform4f(uColorLoc_curve, 0.0, 0.7, 0.7, 1.0);
            gl.drawArrays(gl.LINES, 0, segmentedLines.length / 2);
          }

          if (mouseState.current.intersectLine !== undefined) {
            const line = lines.current.get(mouseState.current.intersectLine);

            if (line) {
              const segmentIndex =
                mouseState.current.intersectSegment !== undefined
                  ? mouseState.current.intersectSegment
                  : line.vertices.length - 1;

              if (segmentIndex >= 0 && segmentIndex < line.vertices.length) {
                const startVertex = vertices.current.get(
                  line.vertices[segmentIndex],
                );

                const endVertex = vertices.current.get(
                  line.vertices[(segmentIndex + 1) % line.vertices.length],
                );

                if (startVertex && endVertex) {
                  const highlightedSegment = [startVertex, endVertex].flatMap(
                    (vertex) => [vertex.coords[0], vertex.coords[1]],
                  );

                  gl.bindBuffer(gl.ARRAY_BUFFER, curveBuffer);
                  gl.bufferData(
                    gl.ARRAY_BUFFER,
                    new Float32Array(highlightedSegment),
                    gl.STATIC_DRAW,
                  );
                  gl.enableVertexAttribArray(curvePosLocation);
                  gl.vertexAttribPointer(
                    curvePosLocation,
                    2,
                    gl.FLOAT,
                    false,
                    0,
                    0,
                  );
                  gl.uniform4f(uColorLoc_curve, 1.0, 0.0, 0.0, 1.0);
                  gl.drawArrays(gl.LINES, 0, highlightedSegment.length / 2);
                }
              }
            }
          }
        }
      }

      if (scrollPassed("show-bezier")) {
        for (const [_idx, line] of lines.current.items) {
          const segments = line.getOrCompute();

          gl.bindBuffer(gl.ARRAY_BUFFER, curveBuffer);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(segments.flat()),
            gl.STATIC_DRAW,
          );
          gl.enableVertexAttribArray(curvePosLocation);
          gl.vertexAttribPointer(curvePosLocation, 2, gl.FLOAT, false, 0, 0);
          gl.uniform4f(uColorLoc_curve, 0.0, 0.0, 0.0, 1.0);
          gl.drawArrays(gl.LINE_STRIP, 0, segments.flat().length / 2);
        }
      }

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        id="viewport"
        className="bg-base-200 absolute top-0 left-0 h-full w-full"
      />
    </div>
  );
}

function linspace(start: number, end: number, num: number) {
  return Array.from(
    { length: num },
    (_, i) => start + (end - start) * (i / (num - 1)),
  );
}

// biome-ignore lint/correctness/noUnusedVariables: <explanation>
function arange(start: number, end: number, step: number) {
  return Array.from(
    { length: Math.ceil((end - start) / step) },
    (_, i) => start + i * step,
  );
}

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
  // Let the CSS handle the size constraints first
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  // Only resize if the canvas size is different from the display size
  const needResize =
    canvas.width !== displayWidth || canvas.height !== displayHeight;
  if (needResize) {
    // Set canvas buffer size to match CSS display size
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
  return needResize;
}

// Most helper codes (or even some patterns in the main loop) in this file is adapted from https://webglfundamentals.org

function compileShader(
  gl: WebGLRenderingContext,
  type: GLenum,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function createProgram(gl: WebGLRenderingContext, ...shaders: WebGLShader[]) {
  const program = gl.createProgram();
  for (const shader of shaders) {
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

function screenToWorld(
  x: number,
  y: number,
  canvas: HTMLCanvasElement,
  pitch: number,
) {
  const rect = canvas.getBoundingClientRect();
  const glX = ((x - rect.left) / rect.width) * 2 - 1;
  const glY = -((y - rect.top) / rect.height) * 2 + 1;

  const aspectRatio = rect.width / rect.height;
  const worldToGLScale = (pitch * 2) / rect.width;

  const worldX = glX / worldToGLScale;
  const worldY = glY / (worldToGLScale * aspectRatio);

  return [worldX, worldY];
}

function distanceFromLineAB(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const ab = glm.vec2.create();
  glm.vec2.sub(ab, b, a);
  const ap = glm.vec2.create();
  glm.vec2.sub(ap, p, a);
  const ab_ap = glm.vec2.dot(ab, ap);
  const ab_ab = glm.vec2.dot(ab, ab);
  const t = Math.max(0, Math.min(1, ab_ap / ab_ab));
  const closestPoint = glm.vec2.create();
  glm.vec2.scaleAndAdd(closestPoint, a, ab, t);
  return glm.vec2.distance(p, closestPoint);
}

const factCache = new Map<number, number>();
// biome-ignore lint/correctness/noUnusedVariables: <explanation>
function fact(x: number): number {
  const cached = factCache.get(x);
  if (cached) return cached;
  if (x <= 1) return 1;
  const res = x * fact(x - 1);
  factCache.set(x, res);
  return res;
}

const combCache = new Map<[number, number], number>();
function comb(n: number, r: number): number {
  const cached = combCache.get([n, r]);
  if (cached) return cached;
  if (r === 0) return 1;
  if (r === 1) return n;
  if (r > n / 2) return comb(n, n - r);
  const res = Math.floor((n * comb(n - 1, r - 1)) / r);
  combCache.set([n, r], res);
  return res;
}
