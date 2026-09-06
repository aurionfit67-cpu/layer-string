"use client";

import { useMemo } from "react";

import { LayerCard, NewLayerTile } from "./layer-card";
import { EmptyLayers } from "@/components/workspace/empty-canvas";
import { useAppState, useStore } from "@/lib/state/provider";
import { layerSummaries } from "@/lib/state/selectors";
import type { LayerSummary } from "@/lib/types";
import { normalize } from "@/lib/utils/fuzzy";

export type SortKey = "recent" | "name" | "size";

const SORTS: Record<SortKey, (a: LayerSummary, b: LayerSummary) => number> = {
  recent: (a, b) => (b.layer.lastOpenedAt ?? 0) - (a.layer.lastOpenedAt ?? 0) || b.layer.updatedAt - a.layer.updatedAt,
  name: (a, b) => a.layer.name.localeCompare(b.layer.name),
  size: (a, b) => b.cardCount - a.cardCount || b.layer.updatedAt - a.layer.updatedAt,
};

/**
 * The Layer list, shared by the home screen and /layers. Filtering happens here
 * (rather than in a second search surface) because this list is short enough to
 * read at a glance — search across card *content* is what ⌘⇧F is for.
 */
export function LayerGrid({
  query = "",
  sort = "recent",
  columns = "lg",
  showAddTile = true,
}: {
  query?: string;
  sort?: SortKey;
  columns?: "sm" | "lg";
  showAddTile?: boolean;
}) {
  const store = useStore();
  const layers = useAppState((state) => state.layers);
  const cards = useAppState((state) => state.cards);
  const order = useAppState((state) => state.cardOrder);

  const summaries = useMemo(() => {
    const all = layerSummaries(layers, cards, order).sort(SORTS[sort]);
    const needle = normalize(query.trim());
    if (!needle) return all;
    const terms = needle.split(/\s+/).filter(Boolean);
    return all.filter((summary) => {
      const haystack = normalize(
        `${summary.layer.name} ${summary.layer.description ?? ""} ${summary.cards
          .map((card) => card.title)
          .join(" ")}`,
      );
      return terms.every((term) => haystack.includes(term));
    });
  }, [cards, layers, order, query, sort]);

  if (layers.length === 0) {
    return (
      <div className="grid gap-3">
        <EmptyLayers onCreate={() => store.setLayerDialog({ mode: "create" })} />
        {showAddTile ? <NewLayerTile compact onCreate={() => store.setLayerDialog({ mode: "create" })} /> : null}
      </div>
    );
  }

  return (
    <div
      className={
        columns === "lg"
          ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          : "grid gap-2.5 sm:grid-cols-2"
      }
    >
      {summaries.length === 0 ? (
        <p className="col-span-full rounded-panel border border-dashed border-line-strong px-4 py-8 text-center text-[12.5px] text-muted">
          No Layer matches “{query.trim()}”.
        </p>
      ) : null}
      {summaries.map((summary) => (
        <LayerCard key={summary.layer.id} summary={summary} />
      ))}
      {showAddTile && !query.trim() ? <NewLayerTile onCreate={() => store.setLayerDialog({ mode: "create" })} /> : null}
    </div>
  );
}

export function SortToggle({ value, onChange }: { value: SortKey; onChange: (next: SortKey) => void }) {
  return (
    <div role="radiogroup" aria-label="Sort Layers" className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-2 p-0.5">
      {(["recent", "name", "size"] as SortKey[]).map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={
            value === key
              ? "rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink shadow-sm"
              : "rounded-full px-2.5 py-1 text-[11.5px] text-muted transition-colors hover:text-ink"
          }
        >
          {key === "recent" ? "Recent" : key === "name" ? "Name" : "Size"}
        </button>
      ))}
    </div>
  );
}
