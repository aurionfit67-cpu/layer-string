"use client";

import { useEffect } from "react";

import { AddCardBar } from "./add-card-bar";
import { CardLayer } from "./card-layer";
import { EmptyCanvas } from "./empty-canvas";
import { LayerHeader } from "./layer-header";
import { LayerListView } from "./layer-list-view";
import { MediaRequest } from "./media-request";
import { WorkspaceCanvas } from "./workspace-canvas";
import { ZoomControls } from "./zoom-controls";
import { Button } from "@/components/ui/button";
import { useCoarsePointer, useCompactShell } from "@/hooks/use-media-query";
import { useAppState, useStore } from "@/lib/state/provider";
import { resolveViewMode } from "@/lib/state/selectors";
import { cn } from "@/lib/utils/cn";

/**
 * A Layer, opened. One full-bleed surface, chrome floating over it, nothing
 * else on screen — the whole point of the product is that this is the entire
 * context for one thing you are doing.
 */
export function LayerWorkspace({ layerId }: { layerId: string }) {
  const store = useStore();
  const layer = useAppState((state) => state.layers.find((candidate) => candidate.id === layerId));
  const compact = useCompactShell();
  const mode = resolveViewMode(layer, useCoarsePointer());

  useEffect(() => {
    if (layer) store.openLayer(layer.id);
    // Only on id change: re-running this would fight the user's own selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerId, store]);

  // A search hit or palette command can arrive from another route, where there is
  // no canvas to point at yet. The target waits on the store; we take it one frame
  // later, once the cards have actually mounted and the camera exists.
  useEffect(() => {
    const cardId = store.consumeReveal(layerId);
    if (!cardId) return;
    const raf = requestAnimationFrame(() => store.revealCard(cardId));
    return () => cancelAnimationFrame(raf);
  }, [layerId, mode, store]);

  if (!layer) return <LayerGone />;

  return (
    <main
      className="relative h-dvh w-full overflow-hidden bg-canvas"
      data-accent={layer.accent ?? "slate"}
      data-layer-workspace={layer.id}
    >
      <LayerHeader layer={layer} compact={compact} />

      {mode === "canvas" ? (
        <WorkspaceCanvas layerId={layer.id} overlay={<WorkspaceChrome layerId={layer.id} compact={compact} />}>
          <CardLayer layerId={layer.id} mode="canvas" />
        </WorkspaceCanvas>
      ) : (
        <>
          <LayerListView layerId={layer.id} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <div className="pointer-events-auto">
              <AddCardBar layerId={layer.id} compact={compact} />
            </div>
          </div>
        </>
      )}

      <MediaRequest />
    </main>
  );
}

function WorkspaceChrome({ layerId, compact }: { layerId: string; compact: boolean }) {
  const snap = useAppState((state) => state.settings.snapToGrid);
  const store = useStore();

  return (
    <>
      <EmptyCanvas layerId={layerId} />
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-2 p-2.5",
          "md:p-4",
        )}
      >
        <div className="pointer-events-auto flex items-center gap-2">
          <AddCardBar layerId={layerId} compact={compact} />
          {!compact ? (
            <button
              type="button"
              onClick={() => store.updateSettings({ snapToGrid: !snap })}
              aria-pressed={snap}
              data-tooltip="Snap to grid  (T)"
              className={cn(
                "chrome h-9 rounded-full border px-3 text-[11.5px] font-medium transition-colors",
                snap
                  ? "border-line text-ink shadow-plate"
                  : "border-transparent text-faint hover:border-line hover:text-muted",
              )}
            >
              Snap {snap ? "on" : "off"}
            </button>
          ) : null}
        </div>
        <div className="pointer-events-auto">
          <ZoomControls />
        </div>
      </div>
    </>
  );
}

function LayerGone(): React.ReactElement {
  return (
    <main className="grid h-dvh place-items-center bg-canvas px-6">
      <div className="max-w-[380px] text-center">
        <p className="eyebrow">Missing Layer</p>
        <h1 className="mt-2 text-[19px] font-semibold tracking-tight text-ink">This Layer isn&rsquo;t in this browser</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          LAYER stores everything locally, so a Layer opened on another device or after a data reset won&rsquo;t
          exist here. Import a backup from Settings to bring it back.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button href="/layers" variant="primary" size="sm">
            All Layers
          </Button>
          <Button href="/settings" variant="ghost" size="sm">
            Import a backup
          </Button>
        </div>
      </div>
    </main>
  );
}
