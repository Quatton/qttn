import {
  useRef,
  useState,
  useCallback,
  type ComponentPropsWithRef,
  useMemo,
} from "react";
import rock from "./rock.png";
import { $sigma, $sigmaColor, $useGaussian, smoothImage } from "./img.store";
import { useStore } from "@nanostores/react";

interface ImageDisplayProps {
  src?: string;
  alt: string;
  caption: string;
  aspectRatio: number;
  onFileUpload?: (file: File) => void;
}

function ImageDisplay({
  ref,
  caption,
  aspectRatio,
  onFileUpload,
  ...props
}: ImageDisplayProps & ComponentPropsWithRef<"img">) {
  return (
    <figure className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="min-h-0 min-w-0 flex-1">
        <div
          style={{ aspectRatio }}
          className="relative h-full overflow-clip rounded-md"
        >
          <ImageOrSkeleton
            ref={ref}
            {...props}
            className="h-full w-full object-contain"
          />
          {onFileUpload && (
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileUpload(file);
              }}
            />
          )}
        </div>
      </div>
      <figcaption className="text-center">{caption}</figcaption>
    </figure>
  );
}

export function Filter() {
  const originalImgRef = useRef<HTMLImageElement>(null);
  const smoothedImgRef = useRef<HTMLImageElement>(null);
  const detailImgRef = useRef<HTMLImageElement>(null);
  const enhancedImgRef = useRef<HTMLImageElement>(null);

  const sigma = useStore($sigma);
  const sigmaColor = useStore($sigmaColor);
  const useGaussian = useStore($useGaussian);

  const [{ width, height }, setDimensions] = useState(() => ({
    width: rock.width,
    height: rock.height,
  }));

  const [imageSource, setImageSource] = useState<string>(rock.src);

  const aspectRatio = width / height;

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImageSource(result);

      const img = new Image();
      setReady(false);
      img.onload = () => {
        setReady(true);
        setDimensions({ width: img.width, height: img.height });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }, []);

  const [ready, setReady] = useState(false);

  const smoothedImageSrc = useMemo(() => {
    if (!imageSource || !originalImgRef.current || !ready) return undefined;
    return smoothImage(originalImgRef.current);
  }, [imageSource, ready, sigma, sigmaColor, useGaussian]);

  const detailImageSrc = useMemo(() => {
    if (!imageSource || !smoothedImgRef.current || !ready) return undefined;
    return imageSource;
  }, [imageSource, ready]);

  const enhancedImageSrc = useMemo(() => {
    if (!imageSource || !detailImgRef.current || !ready) return undefined;
    return imageSource;
  }, [imageSource, ready]);

  return (
    <div className="not-prose flex min-h-0 min-w-0 items-center justify-center p-4">
      <div className="grid aspect-square max-h-full max-w-full grid-cols-2 gap-4">
        <ImageDisplay
          ref={(ref) => {
            originalImgRef.current = ref;
            setReady(true);
          }}
          src={imageSource}
          alt="Original rock texture image"
          caption="Original"
          aspectRatio={aspectRatio}
          onFileUpload={handleFileUpload}
        />
        <ImageDisplay
          ref={smoothedImgRef}
          src={smoothedImageSrc}
          alt="Smoothed rock texture image"
          caption="Smoothed"
          aspectRatio={aspectRatio}
        />
        <ImageDisplay
          ref={detailImgRef}
          src={detailImageSrc}
          alt="Detail enhanced rock texture image"
          caption="Detail"
          aspectRatio={aspectRatio}
        />

        <ImageDisplay
          ref={enhancedImgRef}
          src={enhancedImageSrc}
          alt="Enhanced rock texture image"
          caption="Enhanced"
          aspectRatio={aspectRatio}
        />
      </div>
    </div>
  );
}

export function ControlPanel() {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="flex flex-col items-center">
        <h2 className="text-lg font-semibold">Control Panel</h2>
        <div className="mt-4">
          <label className="label">Sigma (Position Smoothing):</label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            className="range w-full"
            value={useStore($sigma)}
            onChange={(e) => $sigma.set(Number(e.target.value))}
          />
          <label className="label">Sigma Color (Color Smoothing):</label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            className="w-full"
            value={useStore($sigmaColor)}
            onChange={(e) => $sigmaColor.set(Number(e.target.value))}
          />
          <label className="label">Use Gaussian Smoothing:</label>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={useStore($useGaussian)}
            onChange={(e) => $useGaussian.set(e.target.checked)}
          />
        </div>
      </div>
    </div>
  );
}

const ImageOrSkeleton = ({ ref, ...props }: ComponentPropsWithRef<"img">) => {
  return props.src === undefined ? (
    <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-gray-200" />
  ) : (
    <img {...props} ref={ref} />
  );
};
