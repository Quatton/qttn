import { useRef, useState, type ComponentPropsWithRef } from "react";
import rock from "./rock.png";

export function Filter() {
  const originalImgRef = useRef<HTMLImageElement>(null);
  const smoothedImgRef = useRef<HTMLImageElement>(null);
  const detailImgRef = useRef<HTMLImageElement>(null);
  const enhancedImgRef = useRef<HTMLImageElement>(null);

  const [{ width, height }, setDimensions] = useState(() => ({
    width: rock.width,
    height: rock.height,
  }));

  const aspectRatio = width / height;

  return (
    <div className="flex items-center justify-center">
      <div className="not-prose grid aspect-square max-h-full max-w-full grid-cols-2 grid-rows-2 place-content-center gap-2">
        <figure className="flex flex-col items-center justify-center gap-2">
          <div style={{ aspectRatio }} className="w-full">
            <ImageOrSkeleton
              isProcessing={false}
              src={rock.src}
              ref={originalImgRef}
              alt="Original rock texture image"
              className="h-full w-full rounded object-contain"
            />
          </div>
          <figcaption className="text-center text-sm font-medium">
            Original
          </figcaption>
        </figure>
        <figure className="flex flex-col items-center justify-center gap-2">
          <div style={{ aspectRatio }} className="w-full">
            <ImageOrSkeleton
              ref={smoothedImgRef}
              alt="Smoothed rock texture image"
              className="h-full w-full rounded object-contain"
            />
          </div>
          <figcaption className="text-center text-sm font-medium">
            Smoothed
          </figcaption>
        </figure>
        <figure className="flex flex-col items-center justify-center gap-2">
          <div style={{ aspectRatio }} className="w-full">
            <ImageOrSkeleton
              ref={detailImgRef}
              alt="Detail enhanced rock texture image"
              className="h-full w-full rounded object-contain"
            />
          </div>
          <figcaption className="text-center text-sm font-medium">
            Detail
          </figcaption>
        </figure>
        <figure className="flex flex-col items-center justify-center gap-2">
          <div style={{ aspectRatio }} className="w-full">
            <ImageOrSkeleton
              ref={enhancedImgRef}
              alt="Enhanced rock texture image"
              className="h-full w-full rounded object-contain"
            />
          </div>
          <figcaption className="text-center text-sm font-medium">
            Enhanced
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

export function ImageOrSkeleton({
  isProcessing = true,
  ...imgProps
}: ComponentPropsWithRef<"img"> & {
  isProcessing?: boolean;
}) {
  return isProcessing ? (
    <div className="h-full w-full animate-pulse rounded bg-gray-200" />
  ) : (
    <img {...imgProps} />
  );
}
