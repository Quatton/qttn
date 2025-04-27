import { useEffect, useRef, useState } from "react";

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
        scrollIndexMax.current = -1;
        for (const entry of entries) {
          const id = entry.target.id;
          if (!id) continue;

          const index = intersectedElements.current[id];

          if (entry.isIntersecting && index > scrollIndexMax.current) {
            scrollIndexMax.current = index;
          }
        }
      },
      {
        root: scrollParent,
        threshold: 0.1,
        rootMargin: "100px 0px",
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
