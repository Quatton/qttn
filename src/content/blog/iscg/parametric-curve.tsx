import { useEffect, useRef } from "react";
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
  selectedLine: number | undefined;
  ticks: number;
};

type Vertex = {
  coords: [number, number];
  isControlPoint: boolean;
};

export function SimpleCurve() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scrollPassed } = useScrollDetector();
  const serialId = useRef(0);
  const vertices = useRef<Map<number, Vertex>>(new Map<number, Vertex>());
  const lines = useRef<Map<number, number[]>>(new Map<number, number[]>());
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
        vertices.current.delete(mouseState.current.selected);

        for (const [lineIndex, line] of lines.current.entries()) {
          if (line.slice(0, 2).includes(mouseState.current.selected)) {
            lines.current.delete(lineIndex);
          } else {
            lines.current.set(
              lineIndex,
              line.filter(
                (vertexIndex) => vertexIndex !== mouseState.current.selected,
              ),
            );
          }
        }

        mouseState.current.selected = undefined;
      }
    }
    if (e.shiftKey) {
      mouseState.current.shouldSnap = true;
    }
  }

  function keyupHandler(e: KeyboardEvent) {
    mouseState.current.shouldSnap = false;
  }

  function mouseDownHandler(e: MouseEvent) {
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
        id = serialId.current++;
        vertices.current.set(id, {
          coords: [mouseState.current.x, mouseState.current.y],
          isControlPoint: false,
        });
      }
      lines.current.set(serialId.current++, [mouseState.current.selected, id]);
      mouseState.current.selected = id;
      return;
    }

    if (mouseState.current.intersectLine !== undefined) {
      const line = lines.current.get(mouseState.current.intersectLine);
      if (line) {
        const id = serialId.current++;
        vertices.current.set(id, {
          coords: [mouseState.current.x, mouseState.current.y],
          isControlPoint: true,
        });
        line.push(id);
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
      const id = serialId.current++;
      vertices.current.set(id, {
        coords: [mouseState.current.x, mouseState.current.y],
        isControlPoint: false,
      });
      mouseState.current.selected = id;
      return;
    }
  }

  function mouseUpHandler(e: MouseEvent) {
    mouseState.current.isDown = false;

    if (
      mouseState.current.intersect !== undefined &&
      !mouseState.current.isDragging &&
      draggingTimer.current
    ) {
      // Clear the drag timer since we're handling it as a click
      clearTimeout(draggingTimer.current);
      draggingTimer.current = null;
      mouseState.current.selected = mouseState.current.intersect;
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

    for (const [idx, vertex] of vertices.current.entries()) {
      const dist = glm.vec2.distance(
        vertex.coords,
        glm.vec2.fromValues(worldX, worldY),
      );
      if (dist < 0.2) {
        mouseState.current.intersect = idx;
        break;
      }
    }

    if (mouseState.current.intersect === undefined) {
      for (const [idx, line] of lines.current.entries()) {
        const start = vertices.current.get(line[0])?.coords;
        const end = vertices.current.get(line[1])?.coords;
        if (start && end && nearLine([worldX, worldY], start, end, 0.2)) {
          mouseState.current.intersectLine = idx;
          break;
        }
      }
    }

    if (mouseState.current.picked !== undefined && mouseState.current.isDown) {
      if (mouseState.current.isDragging) {
        const pickedVertex = vertices.current.get(mouseState.current.picked);
        if (!pickedVertex) return;
        vertices.current.set(mouseState.current.picked, {
          ...pickedVertex,
          coords: [mouseState.current.x, mouseState.current.y],
        });
      } else {
        if (!draggingTimer.current) {
          draggingTimer.current = setTimeout(() => {
            mouseState.current.isDragging = true;
            draggingTimer.current = null;
          }, 50);
        }
      }
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

        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(axisLines));
        gl.drawArrays(gl.LINES, 0, 4);
      }

      if (scrollPassed("show-circle") && !scrollPassed("show-points")) {
        gl.useProgram(curveProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, curveBuffer);
        gl.enableVertexAttribArray(curvePosLocation);
        gl.vertexAttribPointer(curvePosLocation, 2, gl.FLOAT, false, 0, 0);
        gl.uniform4f(uColorLoc_curve, 0.0, 0.4, 0.0, 1.0);
        gl.uniformMatrix4fv(uScaleMatrixLoc_curve, false, aspectScaleMatrix);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(circle));
        gl.drawArrays(gl.LINE_LOOP, 0, circle.length / 2);
      }

      if (scrollPassed("show-points")) {
        gl.useProgram(pointProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
        gl.enableVertexAttribArray(pointPosLocation);
        gl.vertexAttribPointer(pointPosLocation, 2, gl.FLOAT, false, 0, 0);
        gl.uniform4f(uColorLoc_point, 0.0, 0.0, 0.4, 1.0);

        if (vertices.current.size > 0) {
          const vertexArray = vertices.current
            .entries()
            .flatMap(([_, vertex]) => [vertex.coords[0], vertex.coords[1]]);
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
        gl.uniform4f(uColorLoc_curve, 0.0, 0.4, 0.0, 1.0);
        gl.uniformMatrix4fv(uScaleMatrixLoc_curve, false, aspectScaleMatrix);

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

            gl.bufferSubData(
              gl.ARRAY_BUFFER,
              0,
              new Float32Array(lineVertices),
            );
            gl.drawArrays(gl.LINES, 0, lineVertices.length / 2);
          }
        }

        gl.uniform4f(uColorLoc_curve, 0.0, 0.0, 0.7, 1.0);

        if (lines.current.size > 0) {
          const allLines = Array.from(lines.current.values()).flatMap(
            (line) => {
              const start = vertices.current.get(line[0])?.coords;
              const end = vertices.current.get(line[1])?.coords;
              if (!start || !end) return [];
              return [start[0], start[1], end[0], end[1]];
            },
          );

          if (allLines.length > 0) {
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(allLines));
            gl.drawArrays(gl.LINES, 0, allLines.length / 2);
          }
        }

        if (mouseState.current.intersectLine !== undefined) {
          const line = lines.current.get(mouseState.current.intersectLine);
          if (line) {
            const start = vertices.current.get(line[0])?.coords;
            const end = vertices.current.get(line[1])?.coords;
            if (start && end) {
              gl.uniform4f(uColorLoc_curve, 1.0, 0.0, 0.0, 1.0);
              gl.bufferSubData(
                gl.ARRAY_BUFFER,
                0,
                new Float32Array([start[0], start[1], end[0], end[1]]),
              );
              gl.drawArrays(gl.LINES, 0, 2);
            }
          }
        }
      }

      requestAnimationFrame(render);
    };

    render();
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

function nearLine(
  p: [number, number],
  a: [number, number],
  b: [number, number],
  threshold: number,
) {
  const ab = glm.vec2.create();
  glm.vec2.sub(ab, b, a);
  const ap = glm.vec2.create();
  glm.vec2.sub(ap, p, a);
  const ab_ap = glm.vec2.dot(ab, ap);
  const ab_ab = glm.vec2.dot(ab, ab);
  const t = Math.max(0, Math.min(1, ab_ap / ab_ab));
  const closestPoint = glm.vec2.create();
  glm.vec2.scaleAndAdd(closestPoint, a, ab, t);
  return glm.vec2.distance(p, closestPoint) < threshold;
}
