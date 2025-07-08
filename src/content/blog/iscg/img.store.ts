import { atom, type WritableAtom } from "nanostores";

const vertexShaderSource = /* glsl */ `#version 300 es

in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}`;

const smoothFragmentShaderSource = /* glsl */ `#version 300 es

precision mediump float;
in vec2 v_texCoord;
out vec4 outColor;
uniform sampler2D u_image;
uniform float u_sigma;
uniform float u_sigmaColor;
uniform bool u_useGaussian;

vec4 smoothImageGaussian(vec4 color, float sigma);
vec4 smoothImageBilateral(vec4 color, float sigma, float sigmaColor);

void main() {
  vec4 color = texture(u_image, v_texCoord);

  if (u_useGaussian) {
    color = vec4(
      smoothImageGaussian(color, u_sigma).rgb,
      color.a
    );
  } else {
    color = vec4(
      smoothImageBilateral(color, u_sigma, u_sigmaColor).rgb,
      color.a
    );
  }

  outColor = color;
}

vec4 smoothImageGaussian(vec4 color, float sigma) {
  int r = int(ceil(sigma * 3.0));
  vec2 texelSize = 1.0 / vec2(textureSize(u_image, 0));
  
  vec3 result = vec3(0.0);
  float weightSum = 0.0;
  
  for (int dy = -r; dy <= r; dy++) {
    for (int dx = -r; dx <= r; dx++) {
      vec2 offset = vec2(float(dx), float(dy)) * texelSize;
      vec2 sampleCoord = v_texCoord + offset;

      if (sampleCoord.x < 0.0 || sampleCoord.x > 1.0 || 
          sampleCoord.y < 0.0 || sampleCoord.y > 1.0) {
        continue;
      }
      
      vec4 sampleColor = texture(u_image, sampleCoord);
      float h = sqrt(float(dx * dx + dy * dy));
      float weight = exp(-(h * h) / (2.0 * sigma * sigma));
      
      result += sampleColor.rgb * weight;
      weightSum += weight;
    }
  }
  
  return vec4(result / weightSum, color.a);
}

vec4 smoothImageBilateral(vec4 color, float sigma, float sigmaColor) {
  int r = int(ceil(sigma * 3.0));
  vec2 texelSize = 1.0 / vec2(textureSize(u_image, 0));
  vec3 result = vec3(0.0);
  float weightSum = 0.0;

  for (int dy = -r; dy <= r; dy++) {
    for (int dx = -r; dx <= r; dx++) {
      vec2 offset = vec2(float(dx), float(dy)) * texelSize;
      vec2 sampleCoord = v_texCoord + offset;

      if (sampleCoord.x < 0.0 || sampleCoord.x > 1.0 || 
          sampleCoord.y < 0.0 || sampleCoord.y > 1.0) {
        continue;
      }
      
      vec4 sampleColor = texture(u_image, sampleCoord);
      float h = sqrt(float(dx * dx + dy * dy));
      float weightSpace = exp(-(h * h) / (2.0 * sigma * sigma));
      
      float colorDistance = length(sampleColor.rgb - color.rgb);
      float weightColor = exp(-(colorDistance * colorDistance) / (2.0 * sigmaColor * sigmaColor));
      
      float weight = weightSpace * weightColor;
      
      result += sampleColor.rgb * weight;
      weightSum += weight;
    }
  }

  return vec4(result / weightSum, color.a);
}`;

/** orig - smooth */
const detailFragmentShaderSource = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_texCoord;
out vec4 outColor;
uniform sampler2D u_orig;
uniform sampler2D u_smooth;
uniform float u_detailOffset;

void main() {
  vec4 origColor = texture(u_orig, v_texCoord);
  vec4 smoothColor = texture(u_smooth, v_texCoord);
  vec4 detailColor = (origColor - smoothColor) + u_detailOffset;
  detailColor = clamp(detailColor, 0.0, 1.0);
  
  outColor = vec4(detailColor.rgb, origColor.a);
}`;

/** orig + detail * scale */
export const enhancedFragmentShaderSource = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_texCoord;
out vec4 outColor;
uniform sampler2D u_orig;
uniform sampler2D u_detail;
uniform float u_detailScale;

void main() {
  vec4 origColor = texture(u_orig, v_texCoord);
  vec4 detailColor = texture(u_detail, v_texCoord);
  
  vec4 enhancedColor = origColor + detailColor * u_detailScale;
  enhancedColor = clamp(enhancedColor, 0.0, 1.0);
  
  outColor = enhancedColor;
}`;

export const $useGaussian = atom<boolean>(true);
/** ピクセルの 位置 に関する平滑化の範囲 */
export const $sigma = atom<number>(5);
/** ピクセルの 色 に関する平滑化の範囲 */
export const $sigmaColor = atom<number>(1);
/** Detail offset */
export const $detailOffset = atom<number>(0.5);
/** Detail scale */
export const $detailScale = atom<number>(1.0);

// courtesy of original assignment example
function smoothImageGaussian(imgData: ImageData, sigma: number) {
  const data = imgData.data;

  const r = Math.ceil(sigma * 3);
  const r2 = 2 * r + 1;
  const stencil = new Float32Array(r2 * r2);

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const h = Math.sqrt(dx * dx + dy * dy);
      const idx = (dy + r) * r2 + (dx + r);
      stencil[idx] = Math.exp(-(h * h) / (2 * sigma * sigma));
    }
  }

  for (let px = 0; px < imgData.width; px++) {
    for (let py = 0; py < imgData.height; py++) {
      let rSum = 0,
        gSum = 0,
        bSum = 0,
        weightSum = 0;

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const px1 = px + dx;
          const py1 = py + dy;
          if (
            px1 < 0 ||
            px1 >= imgData.width ||
            py1 < 0 ||
            py1 >= imgData.height
          ) {
            continue; // Skip pixels outside the image bounds
          }
          const idx = (py1 * imgData.width + px1) * 4;
          const weight = stencil[(dy + r) * (2 * r + 1) + (dx + r)];

          rSum += data[idx] * weight;
          gSum += data[idx + 1] * weight;
          bSum += data[idx + 2] * weight;
          weightSum += weight;
        }
      }

      const idx = (py * imgData.width + px) * 4;
      data[idx] = Math.round(rSum / weightSum);
      data[idx + 1] = Math.round(gSum / weightSum);
      data[idx + 2] = Math.round(bSum / weightSum);
      data[idx + 3] = 255;
    }
  }

  return imgData;
}

function smoothImageBilateral(
  imgData: ImageData,
  sigma: number,
  sigmaColor: number,
) {
  const data = imgData.data;

  const r = Math.ceil(sigma * 3);

  const r2 = 2 * r + 1;
  const stencil = new Float32Array(r2 * r2);

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const h = Math.sqrt(dx * dx + dy * dy);
      const idx = (dy + r) * r2 + (dx + r);
      stencil[idx] = Math.exp(-(h * h) / (2 * sigma * sigma));
    }
  }

  for (let px = 0; px < imgData.width; px++) {
    for (let py = 0; py < imgData.height; py++) {
      let rSum = 0,
        gSum = 0,
        bSum = 0,
        weightSum = 0;

      const idx = (py * imgData.width + px) * 4;
      const r0 = data[idx];
      const g0 = data[idx + 1];
      const b0 = data[idx + 2];

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const px1 = px + dx;
          const py1 = py + dy;
          if (
            px1 < 0 ||
            px1 >= imgData.width ||
            py1 < 0 ||
            py1 >= imgData.height
          ) {
            continue;
          }
          const idx1 = (py1 * imgData.width + px1) * 4;
          const weightSpace = stencil[(dy + r) * (2 * r + 1) + (dx + r)];
          // TODO: take distance between pixel colors at idx0 & idx1, plug it into Gaussian
          const r1 = data[idx1];
          const g1 = data[idx1 + 1];
          const b1 = data[idx1 + 2];
          let weightColor = Math.exp(
            -(
              (r1 - r0) * (r1 - r0) +
              (g1 - g0) * (g1 - g0) +
              (b1 - b0) * (b1 - b0)
            ) /
              (2 * sigmaColor * sigmaColor),
          );

          const w = weightSpace * weightColor;
          rSum += r1 * w;
          gSum += g1 * w;
          bSum += b1 * w;
          weightSum += w;
        }
      }

      data[idx] = Math.round(rSum / weightSum);
      data[idx + 1] = Math.round(gSum / weightSum);
      data[idx + 2] = Math.round(bSum / weightSum);
      data[idx + 3] = 255;
    }
  }

  return imgData;
}

class GLRenderer {
  public canvas: HTMLCanvasElement;
  public gl: WebGL2RenderingContext;
  public program: WebGLProgram;
  public positionBuffer: WebGLBuffer;
  public texCoordBuffer: WebGLBuffer;
  public texture: WebGLTexture;

  constructor(
    canvas: HTMLCanvasElement,
    vertexShaderSource: string,
    fragmentShaderSource: string,
  ) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      throw new Error("WebGL2 not supported");
    }
    this.gl = gl;
    this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
    this.positionBuffer = this.createPositionBuffer();
    this.texCoordBuffer = this.createTexCoordBuffer();
    this.texture = this.createTexture();
  }

  public createProgram(
    vertexShaderSource: string,
    fragmentShaderSource: string,
  ): WebGLProgram {
    const gl = this.gl;
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) throw new Error("Failed to create vertex shader");
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error(
        "Vertex shader compilation failed:",
        gl.getShaderInfoLog(vertexShader),
      );
      gl.deleteShader(vertexShader);
      throw new Error("Vertex shader compilation failed");
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) throw new Error("Failed to create fragment shader");
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error(
        "Fragment shader compilation failed:",
        gl.getShaderInfoLog(fragmentShader),
      );
      gl.deleteShader(fragmentShader);
      throw new Error("Fragment shader compilation failed");
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(
        "Shader program linking failed:",
        gl.getProgramInfoLog(program),
      );
      gl.deleteProgram(program);
      throw new Error("Failed to link shader program");
    }

    return program;
  }

  public createPositionBuffer(): WebGLBuffer {
    const gl = this.gl;
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    return positionBuffer;
  }

  public createTexCoordBuffer(): WebGLBuffer {
    const gl = this.gl;
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    return texCoordBuffer;
  }

  public createTexture(): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  }

  public renderToCanvas(): void {
    const gl = this.gl;
    gl.useProgram(this.program);

    const positionLocation = gl.getAttribLocation(this.program, "a_position");
    const texCoordLocation = gl.getAttribLocation(this.program, "a_texCoord");

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(
      positionLocation,
      2, // size
      gl.FLOAT, // type
      false, // normalize
      0, // stride
      0, // offset
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(
      texCoordLocation,
      2, // size
      gl.FLOAT, // type
      false, // normalize
      0, // stride
      0, // offset
    );

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public resize(img: HTMLImageElement): void {
    const gl = this.gl;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = img.width * dpr;
    this.canvas.height = img.height * dpr;
    this.canvas.style.width = `${img.width}px`;
    this.canvas.style.height = `${img.height}px`;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // level
      gl.RGBA, // internal format
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      img,
    );
  }

  public destroy(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.texCoordBuffer);
    gl.deleteTexture(this.texture);
    gl.deleteProgram(this.program);
  }
}

export class SmoothFilterRenderer {
  public glRenderer: GLRenderer;
  public sigmaStore: WritableAtom<number>;
  public sigmaColorStore: WritableAtom<number>;
  public useGaussianStore: WritableAtom<boolean>;

  constructor(
    canvas: HTMLCanvasElement,
    sigma: WritableAtom<number> = $sigma,
    sigmaColor: WritableAtom<number> = $sigmaColor,
    useGaussian: WritableAtom<boolean> = $useGaussian,
  ) {
    this.glRenderer = new GLRenderer(
      canvas,
      vertexShaderSource,
      smoothFragmentShaderSource,
    );
    this.sigmaStore = sigma;
    this.sigmaColorStore = sigmaColor;
    this.useGaussianStore = useGaussian;
  }

  public render(): void {
    const gl = this.glRenderer.gl;
    gl.useProgram(this.glRenderer.program);
    const sigmaLocation = gl.getUniformLocation(
      this.glRenderer.program,
      "u_sigma",
    );
    if (sigmaLocation !== null) {
      gl.uniform1f(sigmaLocation, this.sigmaStore.get());
    }
    const sigmaColorLocation = gl.getUniformLocation(
      this.glRenderer.program,
      "u_sigmaColor",
    );
    if (sigmaColorLocation !== null) {
      gl.uniform1f(sigmaColorLocation, this.sigmaColorStore.get());
    }
    const useGaussianLocation = gl.getUniformLocation(
      this.glRenderer.program,
      "u_useGaussian",
    );
    if (useGaussianLocation !== null) {
      gl.uniform1i(useGaussianLocation, this.useGaussianStore.get() ? 1 : 0);
    }
    this.glRenderer.renderToCanvas();
  }

  public destroy(): void {
    this.glRenderer.destroy();
  }
}

export class DetailFilterRenderer {
  public glRenderer: GLRenderer;
  private smoothTexture: WebGLTexture;

  constructor(
    canvas: HTMLCanvasElement,
    origImg: HTMLImageElement,
    smoothImg: HTMLCanvasElement,
  ) {
    this.glRenderer = new GLRenderer(
      canvas,
      vertexShaderSource,
      detailFragmentShaderSource,
    );
    this.glRenderer.resize(origImg);
    this.smoothTexture = this.glRenderer.createTexture();
    this.setImages(origImg, smoothImg);
  }

  public setImages(
    origImg: HTMLImageElement,
    smoothImg: HTMLCanvasElement,
  ): void {
    const gl = this.glRenderer.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.glRenderer.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // level
      gl.RGBA, // internal format
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      origImg,
    );

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.smoothTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // level
      gl.RGBA, // internal format
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      smoothImg,
    );

    gl.useProgram(this.glRenderer.program);

    const origLocation = gl.getUniformLocation(
      this.glRenderer.program,
      "u_orig",
    );
    const smoothLocation = gl.getUniformLocation(
      this.glRenderer.program,
      "u_smooth",
    );
    if (origLocation !== null) {
      gl.uniform1i(origLocation, 0);
    }
    if (smoothLocation !== null) {
      gl.uniform1i(smoothLocation, 1);
    }

    this.render();
  }

  public render(): void {
    const gl = this.glRenderer.gl;
    gl.useProgram(this.glRenderer.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.glRenderer.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.smoothTexture);

    const detailOffsetLocation = gl.getUniformLocation(
      this.glRenderer.program,
      "u_detailOffset",
    );

    if (detailOffsetLocation !== null) {
      gl.uniform1f(detailOffsetLocation, $detailOffset.get());
    }

    this.glRenderer.renderToCanvas();
  }

  public destroy(): void {
    const gl = this.glRenderer.gl;
    gl.deleteTexture(this.smoothTexture);
    this.glRenderer.destroy();
  }
}

export class EnhancedFilterRenderer {
  public glRenderer: GLRenderer;
  private detailTexture: WebGLTexture;

  constructor(
    canvas: HTMLCanvasElement,
    origImg: HTMLImageElement,
    detailImg: HTMLCanvasElement,
  ) {
    this.glRenderer = new GLRenderer(
      canvas,
      vertexShaderSource,
      enhancedFragmentShaderSource,
    );
    this.glRenderer.resize(origImg);
    this.detailTexture = this.glRenderer.createTexture();
    this.setImages(origImg, detailImg);
  }

  public setImages(
    origImg: HTMLImageElement,
    detailImg: HTMLCanvasElement,
  ): void {
    const gl = this.glRenderer.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.glRenderer.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // level
      gl.RGBA, // internal format
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      origImg,
    );

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.detailTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0, // level
      gl.RGBA, // internal format
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      detailImg,
    );

    gl.useProgram(this.glRenderer.program);

    const origLocation = gl.getUniformLocation(
      this.glRenderer.program,
      "u_orig",
    );
    const detailLocation = gl.getUniformLocation(
      this.glRenderer.program,
      "u_detail",
    );
    if (origLocation !== null) {
      gl.uniform1i(origLocation, 0);
    }
    if (detailLocation !== null) {
      gl.uniform1i(detailLocation, 1);
    }

    this.render();
  }

  public render(): void {
    const gl = this.glRenderer.gl;
    gl.useProgram(this.glRenderer.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.glRenderer.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.detailTexture);

    const detailScaleLocation = gl.getUniformLocation(
      this.glRenderer.program,
      "u_detailScale",
    );

    if (detailScaleLocation !== null) {
      gl.uniform1f(detailScaleLocation, $detailScale.get());
    }

    this.glRenderer.renderToCanvas();
  }

  public destroy(): void {
    const gl = this.glRenderer.gl;
    gl.deleteTexture(this.detailTexture);
    this.glRenderer.destroy();
  }
}
