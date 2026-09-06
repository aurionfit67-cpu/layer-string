"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Roving index for a flat list of options, plus scroll-into-view. Shared by the
 * command palette and search so both behave identically under the keyboard.
 */
export function useRoster(count: number, containerRef: React.RefObject<HTMLElement | null>) {
  const [index, setIndex] = useState(0);
  // Clamped on the way out instead of corrected in an effect: the list shrinks as
  // the query changes, and a stale index must never be visible for a frame.
  const safeIndex = count === 0 ? 0 : Math.min(index, count - 1);
  const previous = useRef(0);

  const scrollActive = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const node = container.querySelector<HTMLElement>(`[data-roster="${safeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [containerRef, safeIndex]);

  useEffect(() => {
    if (previous.current !== safeIndex) {
      previous.current = safeIndex;
      scrollActive();
    }
  }, [safeIndex, scrollActive]);

  const move = useCallback(
    (delta: number) => {
      if (count === 0) return;
      setIndex((value) => (value + delta + count) % count);
    },
    [count],
  );

  return { index: safeIndex, setIndex, move };
}
