import type { Card } from "@/lib/types";
import { CARD_DEFAULT_WIDTH, type Rect } from "@/lib/types";

/** Height used when a card has not reported its measured height yet. */
export const CARD_FALLBACK_HEIGHT = 180;

/** World-space rect of a card. Cards size to content, so `height` is measured. */
/** A card rect with its measured height substituted for the estimate. */
export type MeasuredRect = Rect;

export function cardRect(card: Card): Rect {
  return {
    x: card.position.x,
    y: card.position.y,
    width: card.position.width ?? CARD_DEFAULT_WIDTH,
    height: card.position.height ?? CARD_FALLBACK_HEIGHT,
  };
}

export function cardsInViewport(cards: Card[], viewportRect: Rect, overscan = 240): Card[] {
  return cards.filter((card) => {
    const rect = cardRect(card);
    return (
      rect.x + rect.width >= viewportRect.x - overscan &&
      rect.x <= viewportRect.x + viewportRect.width + overscan &&
      rect.y + rect.height >= viewportRect.y - overscan &&
      rect.y <= viewportRect.y + viewportRect.height + overscan
    );
  });
}

export function boundsOf(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Simple thumbnail geometry for the Layer card preview, normalised to 0..1. */
export function miniLayout(cards: Card[], limit = 12): Array<{ x: number; y: number; w: number; h: number }> {
  const rects = cards.slice(0, limit).map(cardRect);
  const box = boundsOf(rects);
  if (!box || box.width <= 0 || box.height <= 0) return [];
  return rects.map((rect) => ({
    x: (rect.x - box.x) / box.width,
    y: (rect.y - box.y) / box.height,
    w: rect.width / box.width,
    h: Math.min(rect.height, box.height) / box.height,
  }));
}
