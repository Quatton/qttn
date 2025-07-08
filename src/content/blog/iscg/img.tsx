import {
  useRef,
  useState,
  useCallback,
  type ComponentPropsWithRef,
  useEffect,
} from "react";
import rock from "./rock.png";
import {
  $detailOffset,
  $detailScale,
  $sigma,
  $sigmaColor,
  $useGaussian,
  DetailFilterRenderer,
  EnhancedFilterRenderer,
  SmoothFilterRenderer,
} from "./img.store";
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
  children,
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
          >
            {children}
          </ImageOrSkeleton>
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
  const smoothedCanvasRef = useRef<HTMLCanvasElement>(null);
  const detailCanvasRef = useRef<HTMLCanvasElement>(null);
  const enhancedCanvasRef = useRef<HTMLCanvasElement>(null);

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

  useEffect(() => {
    const smoothCanvas = smoothedCanvasRef.current;
    const img = originalImgRef.current;
    const detailCanvas = detailCanvasRef.current;
    const enhancedCanvas = enhancedCanvasRef.current;

    if (!smoothCanvas || !ready || !img || !detailCanvas || !enhancedCanvas) {
      return;
    }

    smoothCanvas.width = img.width;
    smoothCanvas.height = img.height;
    const smoothRenderer = new SmoothFilterRenderer(
      smoothCanvas,
      $sigma,
      $sigmaColor,
    );
    const detailRenderer = new DetailFilterRenderer(
      detailCanvas,
      img,
      smoothCanvas,
    );
    const enhancedRenderer = new EnhancedFilterRenderer(
      enhancedCanvas,
      img,
      detailCanvas,
    );

    function render() {
      if (!img || !smoothCanvas || !detailCanvas) return;
      smoothRenderer.render();
      detailRenderer.setImages(img, smoothCanvas);
      detailRenderer.render();
      enhancedRenderer.setImages(img, detailCanvas);
      enhancedRenderer.render();
    }

    const ro = new ResizeObserver(() => {
      smoothRenderer.glRenderer.resize(img);
      detailRenderer.glRenderer.resize(img);
      enhancedRenderer.glRenderer.resize(img);
      render();
    });
    ro.observe(img);

    const unsubscribeSigma = $sigma.subscribe(() => {
      render();
    });

    const unsubscribeSigmaColor = $sigmaColor.subscribe(() => {
      render();
    });

    const unsubscribeUseGaussian = $useGaussian.subscribe(() => {
      render();
    });

    const unsubscribeDetailOffset = $detailOffset.subscribe(() => {
      render();
    });
    const unsubscribeDetailScale = $detailScale.subscribe(() => {
      render();
    });

    return () => {
      smoothRenderer.destroy();
      detailRenderer.destroy();
      enhancedRenderer.destroy();
      ro.disconnect();
      unsubscribeSigma();
      unsubscribeSigmaColor();
      unsubscribeUseGaussian();
      unsubscribeDetailOffset();
      unsubscribeDetailScale();
    };
  }, [ready, originalImgRef, smoothedCanvasRef]);

  return (
    <div className="not-prose flex min-h-0 min-w-0 items-center justify-center p-4">
      <div className="grid aspect-square max-h-full max-w-full grid-cols-2 gap-4">
        <ImageDisplay
          ref={(ref) => {
            if (!ref) return;
            originalImgRef.current = ref;
            originalImgRef.current.onload = () => {
              setReady(true);
            };
          }}
          src={imageSource}
          alt="Original rock texture image"
          caption="Original"
          aspectRatio={aspectRatio}
          onFileUpload={handleFileUpload}
        />
        <ImageDisplay
          src=" "
          alt="Smoothed rock texture image"
          caption="Smoothed"
          aspectRatio={aspectRatio}
        >
          <canvas className="h-full w-full" ref={smoothedCanvasRef} />
        </ImageDisplay>
        <ImageDisplay
          src=" "
          alt="Detail enhanced rock texture image"
          caption="Detail"
          aspectRatio={aspectRatio}
        >
          <canvas className="h-full w-full" ref={detailCanvasRef} />
        </ImageDisplay>

        <ImageDisplay
          src=" "
          alt="Enhanced rock texture image"
          caption="Enhanced"
          aspectRatio={aspectRatio}
        >
          <canvas className="h-full w-full" ref={enhancedCanvasRef} />
        </ImageDisplay>
      </div>
    </div>
  );
}

export function ControlPanel() {
  const [localSigma, setLocalSigma] = useState(useStore($sigma));
  const [localSigmaColor, setLocalSigmaColor] = useState(useStore($sigmaColor));
  const [localUseGaussian, setLocalUseGaussian] = useState(
    useStore($useGaussian),
  );
  const [localDetailOffset, setLocalDetailOffset] = useState(
    useStore($detailOffset),
  );
  const [localDetailScale, setLocalDetailScale] = useState(
    useStore($detailScale),
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      $sigma.set(localSigma);
      $sigmaColor.set(localSigmaColor);
      $useGaussian.set(localUseGaussian);
      $detailOffset.set(localDetailOffset);
      $detailScale.set(localDetailScale);
    }, 16);
    return () => clearTimeout(timer);
  }, [
    localSigma,
    localSigmaColor,
    localUseGaussian,
    localDetailOffset,
    localDetailScale,
  ]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-lg font-semibold">Smoothing</h2>
      <div>
        <label className="label">Sigma</label>
        <input
          type="range"
          min="0.1"
          max="10"
          step="0.1"
          className="range w-full"
          value={localSigma}
          onChange={(e) => setLocalSigma(Number(e.target.value))}
        />
        <div className="mt-2 flex justify-between px-2.5 text-xs">
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
        </div>
        <div className="mt-2 flex justify-between px-2.5 text-xs">
          <span>0.1</span>
          <span>2.0</span>
          <span>4.0</span>
          <span>6.0</span>
          <span>8.0</span>
          <span>10.0</span>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="range-sigma-color">
          Sigma Range
        </label>{" "}
        <label className="label" htmlFor="use-gaussian">
          (Use Gaussian Smoothing:
          <input
            id="use-gaussian"
            type="checkbox"
            className="checkbox"
            checked={localUseGaussian}
            onChange={(e) => setLocalUseGaussian(e.target.checked)}
          />
          )
        </label>
        <input
          id="range-sigma-color"
          type="range"
          min="0.01"
          max="2"
          step="0.01"
          className="range w-full"
          value={localSigmaColor}
          onChange={(e) => setLocalSigmaColor(Number(e.target.value))}
        />
        <div className="mt-2 flex justify-between px-2.5 text-xs">
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
        </div>
        <div className="mt-2 flex justify-between px-2.5 text-xs">
          <span>0.01</span>
          <span>0.2</span>
          <span>0.4</span>
          <span>0.6</span>
          <span>0.8</span>
          <span>1.0</span>
          <span>1.2</span>
          <span>1.4</span>
          <span>1.6</span>
          <span>1.8</span>
          <span>2.0</span>
        </div>
      </div>
      <h2 className="text-lg font-semibold">Detail & Enhancement</h2>

      <div>
        <label className="label inline-block">Detail Offset</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          className="range w-full"
          value={localDetailOffset}
          onChange={(e) => setLocalDetailOffset(Number(e.target.value))}
        />
        <div className="mt-2 flex justify-between px-2.5 text-xs">
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
        </div>
        <div className="mt-2 flex justify-between px-2.5 text-xs">
          <span>0.0</span>
          <span>0.1</span>
          <span>0.2</span>
          <span>0.3</span>
          <span>0.4</span>
          <span>0.5</span>
          <span>0.6</span>
          <span>0.7</span>
          <span>0.8</span>
          <span>0.9</span>
          <span>1.0</span>
        </div>
      </div>
      <div>
        <label className="label">Detail Scale</label>
        <input
          type="range"
          min="0"
          max="10"
          step="0.1"
          className="range w-full"
          value={localDetailScale}
          onChange={(e) => setLocalDetailScale(Number(e.target.value))}
        />
        <div className="mt-2 flex justify-between px-2.5 text-xs">
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
        </div>
        <div className="mt-2 flex justify-between px-2.5 text-xs">
          <span>0.0</span>
          <span>1.0</span>
          <span>2.0</span>
          <span>3.0</span>
          <span>4.0</span>
          <span>5.0</span>
          <span>6.0</span>
          <span>7.0</span>
          <span>8.0</span>
          <span>9.0</span>
          <span>10.0</span>
        </div>
      </div>
    </div>
  );
}

const ImageOrSkeleton = ({ ref, ...props }: ComponentPropsWithRef<"img">) => {
  return props.src === undefined ? (
    <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-gray-200" />
  ) : props.children ? (
    props.children
  ) : (
    <img {...props} ref={ref} />
  );
};
