import { arrayBufferToBase64, base64ToArrayBuffer } from "./base64";
import type { NamespacedStore, StoreNamespace } from "./types";
import { toStorageError } from "./types";

const ROOT = "layer:v1:";

type MediaEnvelope = { mime: string; base64: string };

/**
 * Fallback adapter for browsers where IndexedDB is blocked (some private
 * windows, locked-down enterprise policies). Same contract, JSON strings only,
 * media base64-encoded. Capacity is the usual ~5 MB, which the UI calls out.
 */
export function createLocalStorageStore(): NamespacedStore {
  const prefix = (namespace: StoreNamespace) => `${ROOT}${namespace}:`;
  const key = (namespace: StoreNamespace, id: string) => `${prefix(namespace)}${id}`;

  const backend = (): Storage => {
    if (typeof localStorage === "undefined") {
      throw toStorageError(new Error("localStorage is not available"));
    }
    return localStorage;
  };

  const decode = <T>(raw: string | null): T | undefined => {
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  };

  const encode = (value: unknown): string => JSON.stringify(value ?? null);

  const mediaKey = (id: string) => key("media", id);
  const isMedia = (namespace: StoreNamespace) => namespace === "media";

  return {
    kind: "localstorage",

    async init() {
      backend().setItem(`${ROOT}probe`, "1");
      backend().removeItem(`${ROOT}probe`);
    },

    async read<T = unknown>(namespace: StoreNamespace, id: string) {
      const stored = decode<unknown>(backend().getItem(key(namespace, id)));
      if (stored === undefined) return undefined;
      if (isMedia(namespace)) {
        const envelope = stored as MediaEnvelope;
        return {
          id,
          mime: envelope.mime,
          data: base64ToArrayBuffer(envelope.base64 ?? ""),
        } as T;
      }
      return (stored as { v: T }).v;
    },

    async list<T = unknown>(namespace: StoreNamespace) {
      const out: T[] = [];
      const needle = prefix(namespace);
      for (let i = 0; i < backend().length; i += 1) {
        const storageKey = backend().key(i);
        if (!storageKey || !storageKey.startsWith(needle)) continue;
        const raw = backend().getItem(storageKey);
        const value = decode<unknown>(raw);
        if (value === undefined) continue;
        if (isMedia(namespace)) {
          const envelope = value as MediaEnvelope;
          out.push({
            id: storageKey.slice(needle.length),
            mime: envelope.mime,
            data: base64ToArrayBuffer(envelope.base64 ?? ""),
          } as T);
          continue;
        }
        out.push((value as { v: T }).v);
      }
      return out;
    },

    async write(namespace, id, value) {
      await this.writeMany(namespace, [[id, value]]);
    },

    async writeMany(namespace, entries) {
      try {
        for (const [id, value] of entries) {
          if (isMedia(namespace)) {
            const media = value as { mime: string; data: ArrayBuffer | string };
            const base64 =
              typeof media.data === "string"
                ? media.data
                : await arrayBufferToBase64(media.data);
            backend().setItem(mediaKey(id), encode({ mime: media.mime, base64 } satisfies MediaEnvelope));
          } else {
            backend().setItem(key(namespace, id), encode({ v: value }));
          }
        }
      } catch (error) {
        throw toStorageError(error);
      }
    },

    async remove(namespace, id) {
      backend().removeItem(key(namespace, id));
    },

    async removeMany(namespace, ids) {
      for (const id of ids) backend().removeItem(key(namespace, id));
    },

    async clear(namespace) {
      const needle = prefix(namespace);
      const doomed: string[] = [];
      for (let i = 0; i < backend().length; i += 1) {
        const storageKey = backend().key(i);
        if (storageKey?.startsWith(needle)) doomed.push(storageKey);
      }
      for (const storageKey of doomed) backend().removeItem(storageKey);
    },

    async estimateUsage() {
      let bytes = 0;
      for (let i = 0; i < backend().length; i += 1) {
        const storageKey = backend().key(i);
        if (!storageKey || !storageKey.startsWith(ROOT)) continue;
        bytes += storageKey.length + (backend().getItem(storageKey)?.length ?? 0);
      }
      return bytes;
    },
  };
}

export async function isLocalStorageAvailable(): Promise<boolean> {
  try {
    if (typeof localStorage === "undefined") return false;
    const probe = "layer:probe";
    localStorage.setItem(probe, "1");
    const ok = localStorage.getItem(probe) === "1";
    localStorage.removeItem(probe);
    return ok;
  } catch {
    return false;
  }
}
