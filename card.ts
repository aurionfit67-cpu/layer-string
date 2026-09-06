/**
 * Card domain model.
 *
 * Every card shares one shape (BaseCard) and is narrowed by a discriminated
 * union on `kind`. Payloads are named `data` (not `content`) so that `content`
 * stays free as a per-type field and so nothing in the model ever shadows a
 * built-in property name.
 */

import type { CardPosition } from "./layout";

export type CardKind = "note" | "task" | "link" | "image" | "file";

export const CARD_KINDS: readonly CardKind[] = [
  "note",
  "task",
  "link",
  "image",
  "file",
];

export function isCardKind(value: unknown): value is CardKind {
  return typeof value === "string" && (CARD_KINDS as readonly string[]).includes(value);
}

/** Human label used in UI, search results and screen-reader announcements. */
export const CARD_KIND_LABEL: Record<CardKind, string> = {
  note: "Note",
  task: "Task",
  link: "Link",
  image: "Image",
  file: "File",
};

export type CardMetadata = {
  /** True for cards that came from the bundled example Layer. */
  demo?: boolean;
  /** Where the card came from, for honest labelling in the UI. */
  source?: "manual" | "demo" | "import";
  /** Anything a future feature (sync, AI, integrations) needs to remember. */
  [key: string]: unknown;
};

export type BaseCard = {
  id: string;
  layerId: string;
  title: string;
  position: CardPosition;
  createdAt: number;
  updatedAt: number;
  /** Card-specific, validated, never rendered raw. */
  metadata: CardMetadata;
};

export type NoteCard = BaseCard & {
  kind: "note";
  data: {
    /** Markdown-ish plain text. Rendered as text only — never as HTML. */
    body: string;
  };
};

export type TaskCard = BaseCard & {
  kind: "task";
  data: {
    done: boolean;
    /** Epoch ms; 0 means "no date". Kept as a number so it stays serialisable. */
    dueAt: number;
    priority: "none" | "low" | "high";
  };
};

export type LinkCard = BaseCard & {
  kind: "link";
  data: {
    /** Already sanitised to http(s)/mailto, or empty. */
    url: string;
    description: string;
  };
};

export type ImageCard = BaseCard & {
  kind: "image";
  data: {
    /** Key of the blob in the media store. */
    mediaId: string;
    name: string;
    mime: string;
    size: number;
    width: number;
    height: number;
    alt: string;
  };
};

export type FileCard = BaseCard & {
  kind: "file";
  data: {
    mediaId: string;
    name: string;
    mime: string;
    size: number;
    /** Free-form note about why the file is here. */
    caption: string;
  };
};

export type Card = NoteCard | TaskCard | LinkCard | ImageCard | FileCard;

export type CardOf<K extends CardKind> = Extract<Card, { kind: K }>;

/** What callers provide before ids/timestamps exist. */
export type NewCard<K extends CardKind = CardKind> = {
  layerId: string;
  kind: K;
  title?: string;
  position?: Partial<CardPosition>;
  data?: Partial<CardOf<K>["data"]>;
  metadata?: CardMetadata;
};

/** Type guard used by the render path so one bad record can never crash a Layer. */
export function isCard(value: unknown): value is Card {
  if (typeof value !== "object" || value === null) return false;
  const card = value as Record<string, unknown>;
  if (typeof card.id !== "string" || typeof card.layerId !== "string") return false;
  if (!isCardKind(card.kind)) return false;
  if (typeof card.title !== "string") return false;
  if (typeof card.position !== "object" || card.position === null) return false;
  const position = card.position as Record<string, unknown>;
  if (typeof position.x !== "number" || typeof position.y !== "number") return false;
  return typeof card.data === "object" && card.data !== null;
}

/** Per-kind defaults for the fields a card always has. */
export function emptyCardData<K extends CardKind>(kind: K): CardOf<K>["data"] {
  switch (kind) {
    case "note":
      return { body: "" } as CardOf<K>["data"];
    case "task":
      return { done: false, dueAt: 0, priority: "none" } as CardOf<K>["data"];
    case "link":
      return { url: "", description: "" } as CardOf<K>["data"];
    case "image":
      return {
        mediaId: "",
        name: "",
        mime: "",
        size: 0,
        width: 0,
        height: 0,
        alt: "",
      } as CardOf<K>["data"];
    case "file":
      return { mediaId: "", name: "", mime: "", size: 0, caption: "" } as CardOf<K>["data"];
  }
}
