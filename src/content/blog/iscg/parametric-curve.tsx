import { useEffect, useRef } from "react";
import * as glm from "gl-matrix";
import { useScrollDetector } from "@/components/react/scroll-detector";

export function SimpleCurve() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scrollPassed } = useScrollDetector();

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctrl = new AbortController();
    main(ctrl);

    return () => {
      cleanup();
      ctrl.abort();
    };
  }, []);

  async function cleanup() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
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
    const gl = canvas.getContext("webgl");

    if (gl === null) {
      alert(
        "Unable to initialize WebGL. Your browser or machine may not support it.",
      );
      return;
    }

    const vertexShaderSource = `
  attribute vec4 a_position;

  void main() {
    gl_Position = a_position;
  }
 `;

    const fragmentShaderSource = `
  precision mediump float;

  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  uniform vec2 u_pitch;
 
  void main() {
    if (mod(gl_FragCoord.x, u_pitch.x) < 1. || mod(gl_FragCoord.y, u_pitch.y) < 1.) {
      gl_FragColor = color;
    } else {
      gl_FragColor = vec4(0.);  
    }
  }
`;

    // Compile shaders
    const vertexShader = compileShader(
      gl,
      gl.VERTEX_SHADER,
      vertexShaderSource,
    );
    const fragmentShader = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentShaderSource,
    );

    if (!vertexShader || !fragmentShader) {
      console.error("Failed to create shaders");
      return;
    }

    const program = createProgram(gl, vertexShader, fragmentShader);

    if (!program) {
      console.error("Failed to create program");
      return;
    }
    gl.useProgram(program);

    // Create buffers
    const positions = [-1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0];
    const indices = [0, 1, 2, 0, 2, 3];

    {
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.STATIC_DRAW,
      );

      const indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(indices),
        gl.STATIC_DRAW,
      );
    }

    // Set up attributes
    {
      const positionLocation = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    }

    const render = () => {
      if (controller.signal.aborted) {
        return;
      }
      // Set up uniforms
      {
        const pitch = [25.0, 25.0];
        const pitchLocation = gl.getUniformLocation(program, "u_pitch");
        gl.uniform2fv(pitchLocation, pitch);
      }

      resizeCanvasToDisplaySize(canvas);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (scrollPassed("show-grid")) {
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
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

function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}
