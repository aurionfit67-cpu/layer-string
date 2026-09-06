/**
 * Derived reads over the store's data. Pure functions taking plain arrays, so
 * they are trivially testable and never create an import cycle with the store.
 */

import type { Card, CardKind, Layer, LayerSummary, ViewMode } from "@/lib/types";
import { truncate } from "@/lib/utils/format";

/** Everything a card exposes to search, as one lowercase haystack. */
export function cardSearchText(card: Card): string {
  const parts: string[] = [card.title];
  switch (card.kind) {
    case "note":
      parts.push(card.data.body);
      break;
    case "task":
      parts.push(card.data.done ? "done completed" : "open todo");
      break;
    case "link":
      parts.push(card.data.url, card.data.description);
      break;
    case "image":
      parts.push(card.data.name, card.data.alt);
      break;
    case "file":
      parts.push(card.data.name, card.data.caption);
      break;
  }
  return parts.filter(Boolean).join(" \u2022 ").toLowerCase();
}

export function cardPreview(card: Card): string {
  switch (card.kind) {
    case "note":
      return truncate(card.data.body, 120);
    case "task":
      return card.data.done ? "Completed" : "Open";
    case "link":
      return card.data.url ? truncate(card.data.url, 100) : card.data.description;
    case "image":
      return truncate(card.data.name || "Image", 100);
    case "file":
      return truncate(card.data.name || "File", 100);
    default:
      return "";
  }
}

export function layerSummaries(layers: Layer[], cards: Record<string, Card>, order: string[]): LayerSummary[] {
  const byLayer = new Map<string, Card[]>();
  for (const id of order) {
    const card = cards[id];
    if (!card) continue;
    const bucket = byLayer.get(card.layerId);
    if (bucket) bucket.push(card);
    else byLayer.set(card.layerId, [card]);
  }
  return layers.map((layer) => {
    const items = byLayer.get(layer.id) ?? [];
    let tasksTotal = 0;
    let tasksDone = 0;
    const kindCounts: Record<string, number> = {};
    for (const card of items) {
      kindCounts[card.kind] = (kindCounts[card.kind] ?? 0) + 1;
      if (card.kind === "task") {
        tasksTotal += 1;
        if (card.data.done) tasksDone += 1;
      }
    }
    return {
      layer,
      cards: items,
      cardCount: items.length,
      tasksTotal,
      tasksDone,
      kindCounts,
    };
  });
}

export type SearchHit =
  | {
      type: "layer";
      key: string;
      layerId: string;
      layerName: string;
      title: string;
      subtitle: string;
      score: number;
    }
  | {
      type: "card";
      key: string;
      layerId: string;
      layerName: string;
      cardId: string;
      cardKind: CardKind;
      title: string;
      subtitle: string;
      preview: string;
      score: number;
    };

/**
 * Local, dependency-free search: whitespace-split terms, all of which must be
 * present (AND), scored by where they matched. No tokenizer, no stemming — at
 * personal-workspace scale this is both fast enough and predictable enough, and
 * it works with zero network access.
 */
export function searchWorkspace(
  query: string,
  layers: Layer[],
  cards: Record<string, Card>,
  order: string[],
  options: { limit?: number; layerId?: string } = {},
): SearchHit[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  if (terms.length === 0) return [];
  const limit = options.limit ?? 24;
  const layerNames = new Map(layers.map((layer) => [layer.id, layer.name]));
  const hits: SearchHit[] = [];

  for (const layer of layers) {
    const haystack = `${layer.name} ${layer.description ?? ""}`.toLowerCase();
    if (terms.every((term) => haystack.includes(term))) {
      const score =
        (layer.name.toLowerCase().startsWith(terms[0] as string) ? 130 : 0) +
        (layer.name.toLowerCase().includes(terms[0] as string) ? 90 : 0) +
        Math.max(0, 30 - hits.length);
      hits.push({
        type: "layer",
        key: `layer:${layer.id}`,
        layerId: layer.id,
        layerName: layer.name,
        title: layer.name,
        subtitle: layer.description ? truncate(layer.description, 90) : "Layer",
        score: score + 20,
      });
    }
  }

  for (const id of order) {
    const card = cards[id];
    if (!card) continue;
    if (options.layerId && card.layerId !== options.layerId) continue;
    const title = card.title.toLowerCase();
    const body = cardSearchText(card);
    if (!terms.every((term) => body.includes(term))) continue;
    const first = terms[0] as string;
    let score = 0;
    if (title.startsWith(first)) score += 120;
    else if (title.includes(first)) score += 80;
    if (card.title === query.trim()) score += 40;
    if (card.layerId === options.layerId) score += 12;
    score += Math.max(0, 20 - hits.length / 4);
    const layerName = layerNames.get(card.layerId) ?? "Layer";
    hits.push({
      type: "card",
      key: `card:${card.id}`,
      layerId: card.layerId,
      layerName,
      cardId: card.id,
      cardKind: card.kind,
      title: card.title || untitledLabel(card.kind),
      subtitle: layerName,
      preview: cardPreview(card) || cardKindPreview(card),
      score,
    });
  }

  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

function untitledLabel(kind: CardKind): string {
  switch (kind) {
    case "note":
      return "Untitled note";
    case "task":
      return "Untitled task";
    case "link":
      return "Untitled link";
    case "image":
      return "Image";
    case "file":
      return "File";
    default:
      return "Card";
  }
}

function cardKindPreview(card: Card): string {
  if (card.kind === "link") return card.data.url ?? "";
  if (card.kind === "file") return card.data.name ?? "";
  if (card.kind === "image") return card.data.name ?? "";
  return "";
}

/** Cards belonging to a Layer, sorted the way the canvas stacks them. */
export function sortCardsForCanvas(cards: Card[]): Card[] {
  return [...cards].sort(
    (a, b) => (a.position.z ?? 0) - (b.position.z ?? 0) || a.createdAt - b.createdAt,
  );
}

/** Tasks first by state, then creation order — used by the mobile list view. */
export function sortCardsForList(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const aOpen = a.kind === "task" && !a.data.done ? 0 : 1;
    const bOpen = b.kind === "task" && !b.data.done ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    if (a.position.z !== b.position.z) return (a.position.z ?? 0) - (b.position.z ?? 0);
    return a.createdAt - b.createdAt;
  });
}

/**
 * Which view a Layer shows. A saved `viewport.mode` is the user's own choice and
 * always wins; an unsaved one means "never chose", so the device decides — a
 * coarse pointer gets the stacked list rather than a shrunken canvas.
 */
export function resolveViewMode(
  layer: { viewport?: { mode?: ViewMode } } | undefined,
  coarse: boolean,
): ViewMode {
  return layer?.viewport?.mode ?? (coarse ? "list" : "canvas");
}
