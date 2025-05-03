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
};

export function SimpleCurve() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scrollPassed } = useScrollDetector();
  const vertices = useRef<glm.vec2[]>([glm.vec2.fromValues(1, 1)]);

  const mouseState = useRef<MouseState>({
    x: 0,
    y: 0,
    isDown: false,
    intersect: undefined,
    picked: undefined,
    selected: undefined,
    shouldSnap: false,
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
        vertices.current.splice(mouseState.current.selected, 1);
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
    if (mouseState.current.intersect !== undefined) {
      mouseState.current.picked = mouseState.current.intersect;
      mouseState.current.selected = mouseState.current.intersect;
    }
    if (
      mouseState.current.picked === undefined &&
      mouseState.current.intersect === undefined
    ) {
      if (mouseState.current.selected !== undefined) {
        mouseState.current.selected = undefined;
        return;
      }
      vertices.current.push(
        glm.vec2.fromValues(mouseState.current.x, mouseState.current.y),
      );
    }
  }

  function mouseUpHandler(e: MouseEvent) {
    mouseState.current.isDown = false;
    mouseState.current.picked = undefined;
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
    for (let i = 0; i < vertices.current.length; i++) {
      const vertex = vertices.current[i];
      const dist = glm.vec2.distance(
        vertex,
        glm.vec2.fromValues(worldX, worldY),
      );
      if (dist < 0.2) {
        mouseState.current.intersect = i;
        break;
      }
    }
    if (mouseState.current.picked !== undefined && mouseState.current.isDown) {
      vertices.current[mouseState.current.picked] = glm.vec2.fromValues(
        mouseState.current.x,
        mouseState.current.y,
      );
    }
  }

  async function cleanup() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2");
    if (!gl) return;

    // Delete all shader programs
    const programs = gl.getParameter(gl.CURRENT_PROGRAM);
    if (programs) {
      gl.deleteProgram(programs);
    }

    // Delete buffers
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

    const allVertices = [...axisLines, ...circle];

    gl.useProgram(curveProgram);
    const curveBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, curveBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(allVertices),
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
        gl.drawArrays(gl.LINES, 0, 4);
      }

      if (scrollPassed("show-circle") && !scrollPassed("show-points")) {
        gl.useProgram(curveProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, curveBuffer);
        gl.enableVertexAttribArray(curvePosLocation);
        gl.vertexAttribPointer(curvePosLocation, 2, gl.FLOAT, false, 0, 0);
        gl.uniform4f(uColorLoc_curve, 0.0, 0.4, 0.0, 1.0);
        gl.uniformMatrix4fv(uScaleMatrixLoc_curve, false, aspectScaleMatrix);
        gl.drawArrays(gl.LINE_LOOP, 4, circle.length / 2);
      }

      if (scrollPassed("show-points")) {
        gl.useProgram(pointProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
        gl.enableVertexAttribArray(pointPosLocation);
        gl.vertexAttribPointer(pointPosLocation, 2, gl.FLOAT, false, 0, 0);
        gl.uniform4f(uColorLoc_point, 0.0, 0.0, 0.4, 1.0);

        if (vertices.current.length > 0) {
          gl.bufferSubData(
            gl.ARRAY_BUFFER,
            0,
            new Float32Array(vertices.current.flatMap((v) => [v[0], v[1]])),
          );
        }

        gl.uniformMatrix4fv(uScaleMatrixLoc_point, false, aspectScaleMatrix);
        gl.drawArrays(gl.POINTS, 0, vertices.current.length);

        if (mouseState.current.intersect !== undefined) {
          const pickedupVertex = vertices.current[mouseState.current.intersect];
          gl.uniform4f(uColorLoc_point, 1.0, 0.0, 0.0, 1.0);
          gl.bufferSubData(
            gl.ARRAY_BUFFER,
            0,
            new Float32Array([pickedupVertex[0], pickedupVertex[1]]),
          );
          gl.drawArrays(gl.POINTS, 0, 1);
        }

        if (
          mouseState.current.isDown &&
          mouseState.current.intersect !== undefined
        ) {
          const selectedVertex = vertices.current[mouseState.current.intersect];
          gl.uniform4f(uColorLoc_point, 0.0, 0.7, 0.0, 1.0);
          gl.bufferSubData(
            gl.ARRAY_BUFFER,
            0,
            new Float32Array([selectedVertex[0], selectedVertex[1]]),
          );
          gl.drawArrays(gl.POINTS, 0, 1);
        }

        if (mouseState.current.selected !== undefined) {
          const selectedVertex = vertices.current[mouseState.current.selected];
          gl.uniform4f(uColorLoc_point, 0.7, 0.7, 0.0, 1.0);
          gl.bufferSubData(
            gl.ARRAY_BUFFER,
            0,
            new Float32Array([selectedVertex[0], selectedVertex[1]]),
          );
          gl.drawArrays(gl.POINTS, 0, 1);
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
