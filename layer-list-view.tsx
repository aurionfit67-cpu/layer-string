"use client";

import { useAppState } from "@/lib/state/provider";
import type { Card } from "@/lib/types";
import { CardView } from "./card-view";

/**
 * List view: the same cards, the same editing, stacked.
 *
 * This is the mobile answer to "a spatial canvas on a phone is miserable".
 * It is also useful on desktop for a quick read-through, so it is a real mode
 * rather than a degraded fallback — and both modes share one card component.
 */
export function LayerListView({ layerId }: { layerId: string }) {
  const layer = useAppState((state) => state.layers.find((candidate) => candidate.id === layerId));
  const cards = useAppState((state) =>
    state.cardOrder
      .map((id) => state.cards[id])
      .filter((card) => Boolean(card) && card?.layerId === layerId)
      .filter((card): card is Card => card !== undefined),
  );

  return (
    <div data-scroll className="absolute inset-0 overflow-y-auto px-3 pb-28 pt-[68px] md:px-5">
      <div className="mx-auto grid max-w-[640px] gap-2.5">
        {layer?.description ? (
          <p className="px-1 text-[12.5px] leading-relaxed text-muted">{layer.description}</p>
        ) : null}
        {cards.length === 0 ? (
          <p className="rounded-panel border border-dashed border-line-strong px-4 py-8 text-center text-[12.5px] text-muted">
            Nothing in this Layer yet. Use Add below.
          </p>
        ) : null}
        {cards.map((card) => (card ? <CardView key={card.id} card={card} mode="list" /> : null))}
      </div>
    </div>
  );
}
