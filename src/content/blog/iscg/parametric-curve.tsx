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
    gl_PointSize = 10.0;
}
`;

const pointFs = `#version 300 es

precision mediump float;
out vec4 fragColor;
uniform vec4 u_color;

void main() {
    float dist = length(gl_PointCoord - vec2(0.5, 0.5));
    if (dist < 0.5) {
        fragColor = u_color;
    } else {
        discard;
    }
}
`;

const PITCH = 50; // 1 world unit = 50 pixels

type MouseState = {
  x: number;
  y: number;
  isDown: boolean;
};

export function SimpleCurve() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scrollPassed } = useScrollDetector();
  // Initialize vertices in world coordinates
  const vertices = useRef<glm.vec2[]>([glm.vec2.fromValues(1, 1)]);

  const mouseState = useRef<MouseState>({
    x: 0,
    y: 0,
    isDown: false,
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctrl = new AbortController();

    canvasRef.current.addEventListener("mousemove", mouseMoveHandler, {
      signal: ctrl.signal,
    });

    main(ctrl);

    return () => {
      cleanup();
      ctrl.abort();
    };
  }, []);

  async function mouseMoveHandler(e: MouseEvent) {
    const tgt = e.target as HTMLCanvasElement;
    if (!tgt) return;

    const rect = tgt.getBoundingClientRect();

    // Convert to GL coordinates first (-1 to 1)
    const glX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const glY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Convert GL coordinates to world coordinates
    const aspectRatio = rect.width / rect.height;
    const worldToGLScale = (PITCH * 2) / rect.width;

    const worldX = glX / worldToGLScale;
    const worldY = glY / (worldToGLScale * aspectRatio);

    mouseState.current.x = worldX;
    mouseState.current.y = worldY;
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
    const uViewMatrixLoc_point = gl.getUniformLocation(
      pointProgram,
      "u_viewMatrix",
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
      if (controller.signal.aborted) return;

      resizeCanvasToDisplaySize(canvas);
      const displayWidth = gl.canvas.width;
      const displayHeight = gl.canvas.height;
      gl.viewport(0, 0, displayWidth, displayHeight);

      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Calculate scale for world to GL coordinates
      const aspectRatio = displayWidth / displayHeight;
      const worldToGLScale = (PITCH * 2) / displayWidth; // How many GL units per world unit

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
            Float32Array.from(vertices.current.flat()),
          );
        }

        gl.uniformMatrix4fv(uScaleMatrixLoc_point, false, aspectScaleMatrix);

        const viewMatrix = glm.mat4.create();
        glm.mat4.identity(viewMatrix);

        gl.uniformMatrix4fv(uViewMatrixLoc_point, false, viewMatrix);

        gl.drawArrays(gl.POINTS, 0, vertices.current.length);
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
