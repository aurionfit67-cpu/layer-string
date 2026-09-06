"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/state/provider";
import { cardRect } from "@/lib/workspace/geometry";
import { cn } from "@/lib/utils/cn";
import { useWorkspace } from "./workspace-canvas";

/**
 * Zoom cluster: −, live percentage (click to reset), +, fit. The percentage
 * subscribes to the camera directly, so it updates during a gesture without
 * putting the whole workspace on React's update path.
 */
export function ZoomControls({ className }: { className?: string }) {
  const { camera, rectOf } = useWorkspace();
  const store = useStore();
  const [percent, setPercent] = useState(() => Math.round(camera.getViewport().scale * 100));

  useEffect(() => {
    let frame = 0;
    const unsubscribe = camera.subscribe(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setPercent(Math.round(camera.getViewport().scale * 100));
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [camera]);

  const fit = () => {
    const id = store.getState().openLayerId;
    if (!id) return;
    const cards = store.cardsOf(id);
    if (cards.length === 0) {
      camera.setViewport({ x: 0, y: 0, scale: 1 }, { animate: true });
      return;
    }
    camera.fitTo(cards.map((card) => ({ ...cardRect(card), height: rectOf(card.id)?.height ?? cardRect(card).height })), {
      padding: 110,
    });
  };

  return (
    <div
      role="group"
      aria-label="Workspace zoom"
      className={cn("chrome flex items-center gap-0.5 rounded-full border border-line p-1 shadow-plate", className)}
    >
      <Button variant="ghost" size="iconSm" aria-label="Zoom out" data-tooltip="Zoom out  (-)" onClick={() => camera.zoomStep(-1)}>
        <MinusGlyph />
      </Button>
      <button
        type="button"
        onClick={() => camera.resetZoom()}
        aria-label={`Zoom ${percent} percent. Activate to reset to 100 percent.`}
        className="h-7 min-w-[48px] rounded-lg px-1 font-mono text-[11px] tabular-nums text-muted transition-colors hover:bg-surface-3 hover:text-ink"
      >
        {percent}%
      </button>
      <Button variant="ghost" size="iconSm" aria-label="Zoom in" data-tooltip="Zoom in  (+)" onClick={() => camera.zoomStep(1)}>
        <PlusGlyph />
      </Button>
      <span role="separator" aria-orientation="vertical" className="mx-0.5 h-4 w-px bg-line" />
      <Button variant="ghost" size="iconSm" aria-label="Fit Layer to screen" data-tooltip="Fit to content  (1)" onClick={fit}>
        <FitGlyph />
      </Button>
    </div>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" } as const;

function MinusGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden {...stroke}>
      <path d="M4 8h8" />
    </svg>
  );
}

function PlusGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden {...stroke}>
      <path d="M8 4v8M4 8h8" />
    </svg>
  );
}

function FitGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden {...stroke}>
      <path d="M2 5.5V2h3.5M10.5 2H14v3.5M14 10.5V14h-3.5M5.5 14H2v-3.5" />
    </svg>
  );
}
