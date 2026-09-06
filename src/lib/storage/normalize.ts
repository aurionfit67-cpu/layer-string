/**
 * Lenient readers for data coming from disk or from an uploaded JSON backup.
 *
 * Everything in storage is treated as untrusted: values are type-checked,
 * strings sanitised, numbers clamped, and a record that cannot be repaired is
 * dropped (returning null) instead of crashing a Layer.
 */

import type {
  Card,
  CardKind,
  CardOf,
  FileCard,
  ImageCard,
  LinkCard,
  NoteCard,
  TaskCard,
} from "@/lib/types/card";
import { CARD_KINDS, emptyCardData, isCardKind } from "@/lib/types/card";
import type { Layer, LayerViewport, ViewMode } from "@/lib/types/layer";
import {
  CARD_MAX_WIDTH,
  CARD_MIN_WIDTH,
  MAX_ZOOM,
  MIN_ZOOM,
  clamp,
} from "@/lib/types/layout";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/types/settings";
import { clampNumber, sanitizeKey, sanitizeLine, sanitizeNumber, sanitizeText } from "@/lib/utils/sanitize";
import { MAX_BODY, MAX_DESCRIPTION, MAX_NAME, MAX_TITLE } from "@/lib/utils/format";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function timestamps(value: Record<string, unknown>): { createdAt: number; updatedAt: number } {
  const now = Date.now();
  const createdAt = clampNumber(value.createdAt, 0, now, now);
  const updatedAt = clampNumber(value.updatedAt, createdAt, now, createdAt);
  return { createdAt, updatedAt };
}

export function normalizeLayer(input: unknown): Layer | null {
  if (!isRecord(input)) return null;
  const id = sanitizeKey(input.id, 80);
  const name = sanitizeLine(input.name, MAX_NAME);
  if (!id || !name) return null;
  const layer: Layer = { id, name, metadata: {}, ...timestamps(input) };

  const description = sanitizeLine(input.description, MAX_DESCRIPTION);
  if (description) layer.description = description;
  const icon = sanitizeKey(input.icon, 40);
  if (icon) layer.icon = icon;
  const accent = sanitizeKey(input.accent, 24);
  if (accent) layer.accent = accent;
  const lastOpenedAt = input.lastOpenedAt;
  if (typeof lastOpenedAt === "number" && Number.isFinite(lastOpenedAt)) {
    layer.lastOpenedAt = clampNumber(lastOpenedAt, 0, Date.now());
  }
  if (isRecord(input.viewport)) layer.viewport = normalizeViewport(input.viewport);
  if (isRecord(input.metadata)) layer.metadata = input.metadata as Layer["metadata"];
  return layer;
}

const MODES: ViewMode[] = ["canvas", "list"];

export function normalizeViewport(input: unknown): LayerViewport {
  const fallback: LayerViewport = { x: 0, y: 0, scale: 1, mode: "canvas" };
  if (!isRecord(input)) return fallback;
  const mode = MODES.includes(input.mode as ViewMode) ? (input.mode as ViewMode) : "canvas";
  return {
    x: sanitizeNumber(input.x, fallback.x),
    y: sanitizeNumber(input.y, fallback.y),
    scale: clamp(sanitizeNumber(input.scale, 1), MIN_ZOOM, MAX_ZOOM),
    mode,
  };
}

export function normalizeSettings(input: unknown): Settings {
  if (!isRecord(input)) return { ...DEFAULT_SETTINGS };
  const theme = input.theme;
  const motion = input.motion;
  return {
    theme: theme === "light" || theme === "dark" ? theme : DEFAULT_SETTINGS.theme,
    motion: motion === "reduced" || motion === "full" ? motion : DEFAULT_SETTINGS.motion,
    snapToGrid: typeof input.snapToGrid === "boolean" ? input.snapToGrid : DEFAULT_SETTINGS.snapToGrid,
    gridSize: clampNumber(input.gridSize, 8, 96, DEFAULT_SETTINGS.gridSize),
    showCardMeta:
      typeof input.showCardMeta === "boolean" ? input.showCardMeta : DEFAULT_SETTINGS.showCardMeta,
    onboarded: typeof input.onboarded === "boolean" ? input.onboarded : DEFAULT_SETTINGS.onboarded,
    version: 1,
  };
}

function normalizePosition(input: unknown): Card["position"] {
  if (!isRecord(input)) return { x: 0, y: 0 };
  return {
    x: sanitizeNumber(input.x, 0),
    y: sanitizeNumber(input.y, 0),
    width:
      typeof input.width === "number"
        ? clamp(Math.round(input.width), CARD_MIN_WIDTH, CARD_MAX_WIDTH)
        : undefined,
    height:
      typeof input.height === "number" && Number.isFinite(input.height)
        ? clamp(Math.round(input.height), 80, 4000)
        : undefined,
    z: typeof input.z === "number" && Number.isFinite(input.z) ? Math.round(input.z) : undefined,
  };
}

/**
 * Accepts anything and returns a fully-typed card, or null when the record is
 * beyond repair (bad kind, missing ids). Payload fields are per-kind.
 */
export function normalizeCard(input: unknown): Card | null {
  if (!isRecord(input)) return null;
  const id = sanitizeKey(input.id, 80);
  const layerId = sanitizeKey(input.layerId, 80);
  const kind = input.kind;
  if (!id || !layerId || !isCardKind(kind)) return null;
  if (!CARD_KINDS.includes(kind as CardKind)) return null;

  const data = isRecord(input.data) ? input.data : {};
  const title = sanitizeLine(input.title, MAX_TITLE);
  const base = {
    id,
    layerId,
    title,
    position: normalizePosition(input.position),
    ...timestamps(input),
    metadata: isRecord(input.metadata) ? (input.metadata as Card["metadata"]) : {},
  };

  switch (kind as CardKind) {
    case "note":
      return {
        ...base,
        kind: "note",
        data: { body: sanitizeText(data.body, MAX_BODY) },
      } satisfies NoteCard;
    case "task": {
      const priority = data.priority;
      return {
        ...base,
        kind: "task",
        data: {
          done: data.done === true,
          dueAt:
            typeof data.dueAt === "number" && Number.isFinite(data.dueAt)
              ? clampNumber(data.dueAt, 0, Date.now() + 3650 * 86_400_000, 0)
              : 0,
          priority:
            priority === "low" || priority === "high" ? priority : emptyCardData("task").priority,
        },
      } satisfies TaskCard;
    }
    case "link":
      return {
        ...base,
        kind: "link",
        data: {
          // The raw string is kept so a half-typed URL survives a reload.
          // `safeExternalUrl()` validates it at the point it becomes an href.
          url: sanitizeLine(data.url, 2048),
          description: sanitizeLine(data.description, MAX_DESCRIPTION),
        },
      } satisfies LinkCard;
    case "image":
      return {
        ...base,
        kind: "image",
        data: {
          mediaId: sanitizeKey(data.mediaId, 80),
          name: sanitizeLine(data.name, MAX_NAME),
          mime: sanitizeLine(data.mime, 80),
          size: clampNumber(data.size, 0, 512 * 1024 * 1024, 0),
          width: clampNumber(data.width, 0, 20_000, 0),
          height: clampNumber(data.height, 0, 20_000, 0),
          alt: sanitizeLine(data.alt, MAX_DESCRIPTION),
        },
      } satisfies ImageCard;
    case "file":
      return {
        ...base,
        kind: "file",
        data: {
          mediaId: sanitizeKey(data.mediaId, 80),
          name: sanitizeLine(data.name, MAX_NAME),
          mime: sanitizeLine(data.mime, 80),
          size: clampNumber(data.size, 0, 512 * 1024 * 1024, 0),
          caption: sanitizeText(data.caption, MAX_DESCRIPTION),
        },
      } satisfies FileCard;
    default:
      return null;
  }
}

export function normalizeCards(input: unknown[]): { cards: Card[]; dropped: number } {
  const cards: Card[] = [];
  let dropped = 0;
  const seen = new Set<string>();
  for (const entry of input) {
    const card = normalizeCard(entry);
    if (!card || seen.has(card.id)) {
      dropped += 1;
      continue;
    }
    seen.add(card.id);
    cards.push(card);
  }
  return { cards, dropped };
}

export function normalizeLayers(input: unknown[]): { layers: Layer[]; dropped: number } {
  const layers: Layer[] = [];
  let dropped = 0;
  const seen = new Set<string>();
  for (const entry of input) {
    const layer = normalizeLayer(entry);
    if (!layer || seen.has(layer.id)) {
      dropped += 1;
      continue;
    }
    seen.add(layer.id);
    layers.push(layer);
  }
  return { layers, dropped };
}

/** Narrow a card by kind for the render path (type-safe, no casts at call site). */
export function asKind<K extends CardKind>(card: Card, kind: K): CardOf<K> | null {
  return card.kind === kind ? (card as CardOf<K>) : null;
}
