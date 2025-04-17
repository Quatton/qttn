import { onMount } from "solid-js";

export function Canvas() {
  onMount(() => {
    main();
  });

  return (
    <canvas
      id="viewport"
      class="bg-base-200 absolute top-0 left-0 h-full w-full"
    />
  );
}

async function main() {
  const canvas = document.querySelector("#viewport") as HTMLCanvasElement;

  if (!canvas) {
    console.error("Canvas element not found");
    return;
  }

  // Initialize the GL context
  const gl = canvas.getContext("webgl");

  // Only continue if WebGL is available and working
  if (gl === null) {
    alert(
      "Unable to initialize WebGL. Your browser or machine may not support it.",
    );
    return;
  }

  // Set clear color to black, fully opaque
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  // Clear the color buffer with specified clear color
  gl.clear(gl.COLOR_BUFFER_BIT);
}
