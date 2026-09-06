"use client";

import { useCallback, useEffect, useState } from "react";

import { useStore } from "@/lib/state/provider";

export type MediaStatus = "idle" | "loading" | "ready" | "missing";

/**
 * Resolves a stored asset into an object URL, cached in the store so ten cards
 * referencing one image cost one blob. Revocation happens on delete/reset.
 */
export function useMediaUrl(mediaId: string | undefined): { url: string | null; status: MediaStatus } {
  const store = useStore();
  // What has actually been resolved; everything else is derived from it below, so
  // a request in flight and a stale result are the same state rather than two.
  const [resolved, setResolved] = useState<{ mediaId: string | null; url: string | null }>({
    mediaId: mediaId ?? null,
    url: null,
  });

  useEffect(() => {
    if (!mediaId) return;
    let current = true;
    const load = async () => {
      const url = await store.objectUrl(mediaId);
      if (current) setResolved({ mediaId, url });
    };
    void load();
    return () => {
      current = false;
    };
  }, [mediaId, store]);

  const fresh = resolved.mediaId === (mediaId ?? null);
  const url = fresh ? resolved.url : null;
  const status: MediaStatus = !mediaId
    ? "idle"
    : !fresh
      ? "loading"
      : resolved.url
        ? "ready"
        : "missing";

  return { url, status };
}

/** Open a stored asset on its own (image preview, "download original"). */
export function useOpenMedia(): (mediaId: string, filename?: string) => Promise<boolean> {
  const store = useStore();
  return useCallback(
    async (mediaId: string, filename?: string) => {
      if (!mediaId) return false;
      const url = await store.objectUrl(mediaId);
      if (!url) return false;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.rel = "noopener";
      if (filename) anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    },
    [store],
  );
}
