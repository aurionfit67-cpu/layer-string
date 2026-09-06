"use client";

import { useEffect, useRef } from "react";

import { useAppState, useStore } from "@/lib/state/provider";

/**
 * The one file input for "Add image / Add file", driven by the store so the
 * toolbar, the command palette and the mobile dock all share a single picker.
 */
export function MediaRequest(): React.ReactElement | null {
  const store = useStore();
  const request = useAppState((state) => state.mediaRequest);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastOpened = useRef<number | null>(null);

  useEffect(() => {
    if (!request || lastOpened.current === request.id) return;
    lastOpened.current = request.id;
    inputRef.current?.click();
  }, [request]);

  return (
    <input
      ref={inputRef}
      type="file"
      accept={request?.accept ?? "*/*"}
      multiple={request?.kind === "image"}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={async (event) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        const kind = request?.kind ?? "file";
        const layerId = store.getState().openLayerId;
        event.target.value = "";
        store.clearMediaRequest();
        if (!layerId) return;
        for (const file of files) await store.attachFile(layerId, kind, file);
      }}
    />
  );
}
