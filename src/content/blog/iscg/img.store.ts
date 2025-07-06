import { atom } from "nanostores";

export const $useGaussian = atom<boolean>(true);
/** ピクセルの 位置 に関する平滑化の範囲 */
export const $sigma = atom<number>(5);
/** ピクセルの 色 に関する平滑化の範囲 */
export const $sigmaColor = atom<number>(1);

export function smoothImage(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const smoothedData = $useGaussian.get()
    ? smoothImageGaussian(imageData, $sigma.get())
    : imageData; // bl

  ctx.putImageData(smoothedData, 0, 0);

  return canvas.toDataURL();
}

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
