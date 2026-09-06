"use client";

import { useAppState } from "@/lib/state/provider";
import type { Card } from "@/lib/types";
import { sortCardsForCanvas, sortCardsForList } from "@/lib/state/selectors";
import { CardView } from "./card-view";

/** The set of cards for one Layer, in canvas order. */
export function CardLayer({ layerId, mode }: { layerId: string; mode: "canvas" | "list" }) {
  const cards = useAppState((state) => {
    const list: Card[] = [];
    for (const id of state.cardOrder) {
      const card = state.cards[id];
      if (card && card.layerId === layerId) list.push(card);
    }
    return mode === "canvas" ? sortCardsForCanvas(list) : sortCardsForList(list);
  });

  if (cards.length === 0) return null;

  return (
    <>
      {cards.map((card) => (
        <CardView key={card.id} card={card} mode={mode} />
      ))}
    </>
  );
}
