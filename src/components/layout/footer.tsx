"use client";

import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/state/provider";

const VERSION = process.env.NEXT_PUBLIC_LAYER_VERSION ?? "0.1.0";

/** Honest status line, not marketing: where the data lives and what version this is. */
export function AppFooter({ onNewLayer = true }: { onNewLayer?: boolean }) {
  const store = useStore();
  return (
    <footer className="relative mt-auto border-t border-line/70 px-4 py-5 md:px-7">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
          Local-first · everything lives in this browser
        </span>
        <span aria-hidden className="hidden sm:inline">
          ·
        </span>
        <span>LAYER v{VERSION}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => store.setOverlay("shortcuts")}>
            Keyboard shortcuts
          </Button>
          {onNewLayer ? (
            <Button variant="ghost" size="sm" onClick={() => store.setLayerDialog({ mode: "create" })}>
              New Layer
            </Button>
          ) : null}
        </span>
      </div>
    </footer>
  );
}
