import {
  useRef,
  useState,
  useCallback,
  forwardRef,
  type ComponentPropsWithRef,
} from "react";
import rock from "./rock.png";

interface ImageDisplayProps {
  src?: string;
  alt: string;
  caption: string;
  aspectRatio: number;
  onFileUpload?: (file: File) => void;
}

function ImageDisplay({
  src,
  alt,
  caption,
  aspectRatio,
  onFileUpload,
  ref,
}: ImageDisplayProps & ComponentPropsWithRef<"img">) {
  return (
    <figure className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="min-h-0 min-w-0 flex-1">
        <div
          style={{ aspectRatio }}
          className="relative h-full overflow-clip rounded-md"
        >
          <ImageOrSkeleton
            src={src}
            ref={ref}
            alt={alt}
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

  const [{ width, height }, setDimensions] = useState(() => ({
    width: rock.width,
    height: rock.height,
  }));

  const [imageSource, setImageSource] = useState<string>(rock.src);
  const [processedImages, setProcessedImages] = useState({
    smoothed: undefined as string | undefined,
    detail: undefined as string | undefined,
    enhanced: undefined as string | undefined,
  });

  const aspectRatio = width / height;

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImageSource(result);

      // Create a temporary image to get dimensions
      const img = new Image();
      img.onload = () => {
        setDimensions({ width: img.width, height: img.height });
        // Process the image here - for now just clearing processed versions
        setProcessedImages({
          smoothed: undefined,
          detail: undefined,
          enhanced: undefined,
        });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }, []);

  return (
    <div className="not-prose flex min-h-0 min-w-0 items-center justify-center p-4">
      <div className="grid aspect-square max-h-full max-w-full grid-cols-2 gap-4">
        <ImageDisplay
          ref={originalImgRef}
          src={imageSource}
          alt="Original rock texture image"
          caption="Original"
          aspectRatio={aspectRatio}
          onFileUpload={handleFileUpload}
        />
        <ImageDisplay
          ref={smoothedImgRef}
          src={processedImages.smoothed}
          alt="Smoothed rock texture image"
          caption="Smoothed"
          aspectRatio={aspectRatio}
        />
        <ImageDisplay
          ref={detailImgRef}
          src={processedImages.detail}
          alt="Detail enhanced rock texture image"
          caption="Detail"
          aspectRatio={aspectRatio}
        />
        <ImageDisplay
          ref={enhancedImgRef}
          src={processedImages.enhanced}
          alt="Enhanced rock texture image"
          caption="Enhanced"
          aspectRatio={aspectRatio}
        />
      </div>
    </div>
  );
}

const ImageOrSkeleton = forwardRef<
  HTMLImageElement,
  ComponentPropsWithRef<"img">
>(({ ...imgProps }, ref) => {
  return imgProps.src === undefined ? (
    <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-gray-200" />
  ) : (
    <img {...imgProps} ref={ref} />
  );
});
