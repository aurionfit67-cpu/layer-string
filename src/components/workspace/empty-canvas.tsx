"use client";

import { CornerDownLeft, NotebookPen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combo } from "@/components/ui/combo";
import { useAppState, useStore } from "@/lib/state/provider";

/** First-run state of a Layer: one obvious action, plus how the canvas works. */
export function EmptyCanvas({ layerId }: { layerId: string }) {
  const store = useStore();
  const count = useAppState(
    (state) => state.cardOrder.filter((id) => state.cards[id]?.layerId === layerId).length,
  );
  if (count > 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center px-6">
      <div className="pointer-events-auto max-w-[340px] rounded-panel border border-dashed border-line-strong bg-surface/80 p-5 text-center shadow-plate backdrop-blur-sm">
        <h2 className="text-[14px] font-semibold tracking-tight text-ink">Nothing here yet</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Notes, tasks, links and files all live on this surface. Put the first one where it belongs.
        </p>
        <div className="mt-3.5 flex items-center justify-center gap-2">
          <Button variant="primary" size="sm" onClick={() => store.addCard(layerId, "note")}>
            <NotebookPen size={14} aria-hidden />
            Add a note
          </Button>
          <Button variant="ghost" size="sm" onClick={() => store.addCard(layerId, "task")}>
            Add a task
          </Button>
        </div>
        <p className="mt-3.5 flex items-center justify-center gap-1.5 text-[11px] text-faint">
          <CornerDownLeft size={11} aria-hidden />
          Double-click anywhere on the canvas · drag the background to pan
        </p>
      </div>
    </div>
  );
}

export function EmptyLayers({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-panel border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="text-[13.5px] font-medium text-ink">No Layers yet</p>
      <p className="mx-auto mt-1 max-w-[42ch] text-[12.5px] leading-relaxed text-muted">
        A Layer is one thing you are doing — with every note, task and link it needs inside it.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button variant="primary" size="sm" onClick={onCreate}>
          Create your first Layer
        </Button>
        <span className="text-[11px] text-faint">
          or <Combo keys={["Mod", "N"]} />
        </span>
      </div>
    </div>
  );
}
