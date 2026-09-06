/**
 * Storage abstraction.
 *
 * The application never talks to IndexedDB directly. It talks to
 * `LayerRepository` (see repository.ts), which is implemented on top of a tiny
 * namespaced key-value contract (`NamespacedStore`). Three adapters exist:
 * IndexedDB (durable, default), localStorage (fallback for browsers that block
 * IndexedDB) and memory (degraded mode + tests).
 *
 * A future cloud backend (Supabase/Postgres, sync, accounts) is added by
 * implementing `NamespacedStore` — the whole application, including the UI,
 * stays as it is.
 */

import type { Card } from "@/lib/types/card";
import type { Layer } from "@/lib/types/layer";
import type { Settings, StorageInfo } from "@/lib/types/settings";

export const NAMESPACES = ["layers", "cards", "media", "kv"] as const;

export type StoreNamespace = (typeof NAMESPACES)[number];

/** A namespace holds plain JSON-ish records keyed by their record id. */
export type NamespacedStore = {
  readonly kind: StorageInfo["kind"];
  init(): Promise<void>;
  read<T = unknown>(namespace: StoreNamespace, key: string): Promise<T | undefined>;
  list<T = unknown>(namespace: StoreNamespace): Promise<T[]>;
  write(namespace: StoreNamespace, key: string, value: unknown): Promise<void>;
  writeMany(namespace: StoreNamespace, entries: Array<[string, unknown]>): Promise<void>;
  remove(namespace: StoreNamespace, key: string): Promise<void>;
  removeMany(namespace: StoreNamespace, keys: string[]): Promise<void>;
  clear(namespace: StoreNamespace): Promise<void>;
  /** Approximate bytes used, when the backend can report it. */
  estimateUsage(): Promise<number | null>;
  close?(): void;
};

/** The whole local database, as one snapshot. This is also the export shape. */
export type RawSnapshot = {
  layers: Layer[];
  cards: Card[];
  settings: Settings;
  media: MediaDescriptor[];
};

export type MediaDescriptor = { id: string; mime: string; size: number };

export type MediaBlob = { id: string; mime: string; data: ArrayBuffer | string };

export type Repository = {
  readonly info: StorageInfo;
  ready(): Promise<boolean>;
  /** Layers and cards, already validated: anything unreadable is dropped. */
  loadSnapshot(): Promise<RawSnapshot>;
  saveLayer(layer: Layer): Promise<void>;
  deleteLayer(id: string): Promise<void>;
  saveCards(cards: Card[]): Promise<void>;
  deleteCards(ids: string[]): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  saveFlag(key: string, value: unknown): Promise<void>;
  loadFlag<T = unknown>(key: string): Promise<T | undefined>;
  putMedia(media: MediaBlob): Promise<void>;
  getMedia(id: string): Promise<MediaBlob | undefined>;
  deleteMedia(ids: string[]): Promise<void>;
  /** Import entry points. */
  replaceAll(snapshot: RawSnapshot, media: MediaBlob[]): Promise<void>;
  mergeInto(layers: Layer[], cards: Card[], settings?: Partial<Settings>): Promise<void>;
  wipe(): Promise<void>;
  estimateUsageBytes(): Promise<number | null>;
};

export class StorageUnavailableError extends Error {
  readonly quotaExceeded: boolean;

  constructor(message: string, options?: { quotaExceeded?: boolean }) {
    super(message);
    this.name = "StorageUnavailableError";
    this.quotaExceeded = options?.quotaExceeded === true;
  }
}

/** Normalises adapter failures into something the UI can explain. */
export function toStorageError(error: unknown): StorageUnavailableError {
  if (error instanceof StorageUnavailableError) return error;
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";
  const quota = /quota|disk|storage/i.test(name) || /quota|space/i.test(String(error));
  return new StorageUnavailableError(
    quota
      ? "Local storage is full. Remove large images or files, then try again."
      : "Local storage failed to respond. Recent changes may not be saved.",
    { quotaExceeded: quota },
  );
}

