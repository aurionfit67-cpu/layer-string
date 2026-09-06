"use client";

import { useState } from "react";

import { FatalStorage } from "@/components/layout/fatal-storage";
import { AppFooter } from "@/components/layout/footer";
import { TopBar } from "@/components/layout/top-bar";
import { LayerGrid, SortToggle, type SortKey } from "@/components/layers/layer-grid";
import { Button } from "@/components/ui/button";
import { useLayerState } from "@/lib/state/provider";

/**
 * The list on its own, for when there are enough Layers that the home screen
 * stops being a shortcut. Filtering is name/description/title only — full-text
 * search over card content lives behind ⌘⇧F and the palette.
 */
export default function LayersPage() {
  const { state, store } = useLayerState();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  if (state.status === "error") return <FatalStorage message={state.fatalError} />;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <TopBar crumb="Layers" />

      <section className="px-4 pb-5 pt-8 md:px-7 md:pt-11">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[clamp(22px,3.2vw,30px)] font-semibold leading-tight tracking-[-0.028em] text-ink">
              All Layers
            </h1>
            <p className="mt-1.5 text-[13px] text-muted">
              {state.layers.length === 0
                ? "Nothing here yet."
                : `${state.layers.length} ${state.layers.length === 1 ? "Layer" : "Layers"} · ${state.cardOrder.length} cards`}
            </p>
          </div>
          <Button variant="primary" onClick={() => store.setLayerDialog({ mode: "create" })}>
            New Layer
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden>
              <SearchGlyph />
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter Layers by name, description or card title"
              aria-label="Filter Layers"
              className="h-9 w-full rounded-[10px] border border-line bg-surface pl-8 pr-3 text-[13px] text-ink outline-none transition-colors placeholder:text-faint hover:border-line-strong focus:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_12%,transparent)]"
            />
          </div>
          <SortToggle value={sort} onChange={setSort} />
        </div>
      </section>

      <section className="flex-1 px-4 pb-14 md:px-7">
        <LayerGrid query={query} sort={sort} />
      </section>

      <AppFooter />
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" strokeLinecap="round" />
    </svg>
  );
}
