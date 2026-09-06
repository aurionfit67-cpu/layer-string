"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Media queries as an external store rather than a setState-in-effect
 * subscription: one code path for mount and for change, and the value is already
 * correct on the first client render.
 */
function readMediaQuery(query: string): boolean {
  return typeof window !== "undefined" ? window.matchMedia(query).matches : false;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined") return () => {};
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => readMediaQuery(query), [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * The same query without a subscription, for global handlers (Hotkeys) that must
 * not re-bind on every breakpoint change.
 */
export function isCoarsePointer(): boolean {
  return readMediaQuery("(pointer: coarse)");
}

/** Coarse pointer + narrow viewport: the workspace swaps to touch ergonomics. */
export function useCompactShell(): boolean {
  return useMediaQuery("(max-width: 860px)");
}

export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)");
}

/** True on the desktop-class layout, where hover affordances are safe. */
export function usePrecisePointer(): boolean {
  return !useCoarsePointer();
}
