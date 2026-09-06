import type { NamespacedStore, StoreNamespace } from "./types";

/**
 * Ephemeral adapter used when no durable store is available (private browsing
 * with both IndexedDB and localStorage blocked, unit tests). The whole product
 * keeps working; the UI shows a persistent banner explaining that data will be
 * lost on reload.
 */
export function createMemoryStore(): NamespacedStore {
  const data = new Map<string, unknown>();
  const key = (namespace: StoreNamespace, id: string) => `${namespace}:${id}`;

  return {
    kind: "unavailable",

    async init() {
      /* nothing to open */
    },

    async read<T = unknown>(namespace: StoreNamespace, id: string) {
      return data.get(key(namespace, id)) as T | undefined;
    },

    async list<T = unknown>(namespace: StoreNamespace) {
      const needle = `${namespace}:`;
      const out: T[] = [];
      for (const [entryKey, value] of data) {
        if (entryKey.startsWith(needle)) out.push(value as T);
      }
      return out;
    },

    async write(namespace, id, value) {
      data.set(key(namespace, id), value);
    },

    async writeMany(namespace, entries) {
      for (const [id, value] of entries) data.set(key(namespace, id), value);
    },

    async remove(namespace, id) {
      data.delete(key(namespace, id));
    },

    async removeMany(namespace, ids) {
      for (const id of ids) data.delete(key(namespace, id));
    },

    async clear(namespace) {
      const needle = `${namespace}:`;
      for (const entryKey of [...data.keys()]) {
        if (entryKey.startsWith(needle)) data.delete(entryKey);
      }
    },

    async estimateUsage() {
      return null;
    },
  };
}
