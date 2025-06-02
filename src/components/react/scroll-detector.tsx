import { useEffect, useMemo, useRef, useState } from "react";

type ScrollElementCache = {
  [id: string]: number; // back to storing indices
};

export function useScrollDetector() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const intersectedElements = useRef<ScrollElementCache>({});
  const scrollIndexMax = useRef(-1);

  useEffect(() => {
    const scrollParent = document.getElementById("sp");
    if (!scrollParent) return;

    // Cache indices first
    const elements = Array.from(scrollParent.getElementsByClassName("sd"));
    elements.forEach((element, index) => {
      const id = element.id;
      if (id) {
        intersectedElements.current[id] = index;
      }
    });

    observerRef.current = new IntersectionObserver(
      (entries) => {
        let scrollMax = -1;
        for (const entry of entries) {
          const id = entry.target.id;
          if (!id) continue;

          const index = intersectedElements.current[id];

          if (entry.isIntersecting && index > scrollMax) {
            scrollMax = index;
          }
        }
        if (scrollMax === -1) return;
        scrollIndexMax.current = scrollMax;
      },
      {
        root: scrollParent,
        threshold: 0.5, // Increased from 0.1 to require more visibility
        rootMargin: "20px 0px", // Reduced from 100px to make detection area smaller
      },
    );

    // Observe all scroll detector elements
    for (const element of elements) {
      observerRef.current?.observe(element);
    }

    return () => {
      observerRef.current?.disconnect();
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
  const observerRef = useRef<IntersectionObserver | null>(null);
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

    observerRef.current = new IntersectionObserver(
      (entries) => {
        let scrollMax = -1;
        for (const entry of entries) {
          const id = entry.target.id;
          if (!id) continue;

          const index = intersectedElements.current[id];

          if (entry.isIntersecting && index > scrollMax) {
            scrollMax = index;
          }
        }
        if (scrollMax === -1) return;
        setScrollIndexMax(scrollMax);
      },
      {
        root: scrollParent,
        threshold: 0.5,
        rootMargin: "20px 0px",
      },
    );

    // Observe all scroll detector elements
    for (const element of elements) {
      observerRef.current?.observe(element);
    }

    return () => {
      observerRef.current?.disconnect();
    };
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
