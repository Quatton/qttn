import { useCallback, useEffect, useRef, useState } from "react";

export function RayTracing() {
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<RayTracingRenderer | null>(null);

  const initRayTracing = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = rendererRef.current || new RayTracingRenderer(canvas);
    if (!renderer.isInitialized()) {
      try {
        await renderer.init();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to initialize WebGPU.",
        );
        return;
      }
    }

    if (!renderer.isInitialized()) {
      setError("WebGPU is not initialized properly.");
      return;
    }

    const device = renderer.device;

    const module = device.createShaderModule({
      label: "our hardcoded red triangle shaders",
      code: /* wgsl */ `
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );
 
        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }
 
      @fragment fn fs() -> @location(0) vec4f {
        return vec4f(1.0, 0.0, 0.0, 1.0);
      }
    `,
    });

    const pipeline = device.createRenderPipeline({
      label: "our hardcoded red triangle pipeline",
      layout: "auto",
      vertex: {
        module,
      },
      fragment: {
        module,
        targets: [{ format: renderer.format }],
      },
    });

    const renderPassDescriptor = {
      label: "our basic canvas renderPass",
      colorAttachments: [
        {
          // view: <- to be filled out when we render
          clearValue: [0.3, 0.3, 0.3, 1],
          loadOp: "clear",
          storeOp: "store",
          view: undefined as GPUTextureView | undefined,
        },
      ],
    };

    function render() {
      if (!renderer.isInitialized()) {
        return;
      }
      // Get the current texture from the canvas context and
      // set it as the texture to render to.
      renderPassDescriptor.colorAttachments[0].view = renderer.context
        .getCurrentTexture()
        .createView();

      // make a command encoder to start encoding commands
      const encoder = device.createCommandEncoder({ label: "our encoder" });

      // make a render pass encoder to encode render specific commands
      const pass = encoder.beginRenderPass(
        renderPassDescriptor as GPURenderPassDescriptor,
      );
      pass.setPipeline(pipeline);
      pass.draw(3); // call our vertex shader 3 times
      pass.end();

      const commandBuffer = encoder.finish();
      device.queue.submit([commandBuffer]);
    }

    render();
  }, [canvasRef, setError]);

  useEffect(() => {
    initRayTracing();
  }, []);

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

interface RayTracingRendererReady extends RayTracingRenderer {
  device: NonNullable<RayTracingRenderer["device"]>;
  context: NonNullable<RayTracingRenderer["context"]>;
  format: NonNullable<RayTracingRenderer["format"]>;
}

class RayTracingRenderer {
  canvas: HTMLCanvasElement;
  device: GPUDevice | undefined = undefined;
  context: GPUCanvasContext | null = null;
  format: GPUTextureFormat | undefined = undefined;

  // in WebGPU world, we get adapter and then we throw it away so I don't really need to store it
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // I should call init() here but I want to await it but I can't in constructor
    // so I will call it in the initRayTracing function instead
  }

  isInitialized(): this is RayTracingRendererReady {
    return !!this.device && !!this.context && !!this.format;
  }

  async init() {
    const adapter = await navigator.gpu?.requestAdapter();
    this.device = await adapter?.requestDevice();

    if (!this.device) {
      throw new Error("WebGPU is not supported in this browser.");
    }

    this.context = this.canvas.getContext("webgpu");

    if (!this.context) {
      throw new Error("Failed to get WebGPU context.");
    }

    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
    });
  }
}
