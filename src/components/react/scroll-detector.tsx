import { useEffect, useMemo, useRef, useState } from "react";

type ScrollElementCache = {
  [id: string]: number; // back to storing indices
};

export function useScrollDetector(
  hook?: (scrollPassed: (id: string) => boolean) => void,
) {
  const intersectedElements = useRef<ScrollElementCache>({});
  const scrollIndexMax = useRef(-1);

  useEffect(() => {
    const scrollParent = document.getElementById("sp") as HTMLDivElement | null;
    if (!scrollParent) return;

    // Cache indices and Y positions first
    const elements = Array.from(scrollParent.getElementsByClassName("sd"));
    elements.forEach((element, index) => {
      const id = element.id;
      if (id) {
        intersectedElements.current[id] = index;
      }
    });

    const ctrl = new AbortController();

    scrollParent.addEventListener(
      "scroll",
      () => {
        let scrollMax = -1;
        for (const element of elements) {
          const id = element.id;
          if (!id) continue;
          const index = intersectedElements.current[id];
          const rect = element.getBoundingClientRect();
          const isIntersecting =
            rect.top < scrollParent.clientHeight && rect.bottom > 0;
          if (isIntersecting && index > scrollMax) {
            scrollMax = index;
          }
        }
        if (scrollMax === -1) return;
        const prev = scrollIndexMax.current;
        scrollIndexMax.current = scrollMax;

        if (prev !== scrollMax && hook) {
          hook?.(scrollPassed);
        }
      },
      { signal: ctrl.signal },
    );

    return () => {
      ctrl.abort();
    };
  }, []);

  const scrollPassed = (id: string): boolean => {
    const index = intersectedElements.current[id];
    if (typeof index === "undefined") return false;
    return index <= scrollIndexMax.current;
  };

  return { scrollPassed };
}

export function useScrollDetectorState() {
  const intersectedElements = useRef<ScrollElementCache>({});
  const [scrollIndexMax, setScrollIndexMax] = useState(-1);

  useEffect(() => {
    const scrollParent = document.getElementById("sp");
    if (!scrollParent) return;

    // Cache indices first
    const elements = Array.from(scrollParent.getElementsByClassName("sd"));
    const newCache: ScrollElementCache = {};
    elements.forEach((element, index) => {
      const id = element.id;
      if (id) {
        newCache[id] = index;
      }
    });
    intersectedElements.current = newCache;

    const ctrl = new AbortController();

    scrollParent.addEventListener(
      "scroll",
      () => {
        let scrollMax = -1;
        for (const element of elements) {
          const id = element.id;
          if (!id) continue;
          const index = intersectedElements.current[id];
          const rect = element.getBoundingClientRect();
          const isIntersecting =
            rect.top < scrollParent.clientHeight && rect.bottom > 0;
          if (isIntersecting && index > scrollMax) {
            scrollMax = index;
          }
        }
        if (scrollMax === -1) return;

        setScrollIndexMax((prev) => {
          if (prev !== scrollMax) {
            return scrollMax;
          }
          return prev;
        });
      },
      { signal: ctrl.signal },
    );
  }, []);

  // Use reduce to derive scrollPassed
  const scrollPassed = useMemo(() => {
    return Object.entries(intersectedElements.current).reduce<{
      [id: string]: boolean;
    }>((acc, [id, index]) => {
      acc[id] = index <= scrollIndexMax;
      return acc;
    }, {});
  }, [intersectedElements, scrollIndexMax]);

  return { scrollPassed };
}
