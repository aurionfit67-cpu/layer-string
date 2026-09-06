import { openDB, type IDBPDatabase } from "idb";

import type { NamespacedStore, StoreNamespace } from "./types";
import { NAMESPACES, StorageUnavailableError, toStorageError } from "./types";

const DB_NAME = "layer-workspace";
const DB_VERSION = 1;
const STORE = "records";
const SEP = ":";

type LayerDbSchema = {
  records: {
    key: string;
    value: { k: string; v: unknown };
  };
};

/**
 * Primary adapter: one IndexedDB object store of `key -> record` pairs, where the
 * key is `<namespace>:<id>`. Namespaces are declared in types.ts.
 *
 * Structured clone means image and file bytes are stored as real ArrayBuffer
 * instead of an inflated base64 string, which is why LAYER can hold screenshots
 * and PDFs without eating the quota.
 */
export function createIndexedDbStore(): NamespacedStore {
  let opening: Promise<IDBPDatabase<LayerDbSchema>> | null = null;
  let broken = false;

  const open = (): Promise<IDBPDatabase<LayerDbSchema>> => {
    if (broken) {
      return Promise.reject(new StorageUnavailableError("IndexedDB is unavailable in this browser."));
    }
    if (!opening) {
      opening = openDB<LayerDbSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        },
      }).catch((error: unknown) => {
        broken = true;
        opening = null;
        throw toStorageError(error);
      });
    }
    return opening;
  };

  // Two helpers with literal modes: idb types write/delete as
  // `Mode extends "readonly" ? undefined : …`, so passing a union mode would
  // make every mutating method "possibly undefined" for no good reason.
  const readonlyRecords = async () => {
    const transaction = (await open()).transaction(STORE, "readonly");
    return { store: transaction.objectStore(STORE), transaction };
  };

  const readwriteRecords = async () => {
    const transaction = (await open()).transaction(STORE, "readwrite");
    return { store: transaction.objectStore(STORE), transaction };
  };

  const key = (namespace: StoreNamespace, id: string) => `${namespace}${SEP}${id}`;
  const range = (namespace: StoreNamespace) =>
    IDBKeyRange.bound(`${namespace}${SEP}`, `${namespace}${SEP}\uffff`);

  return {
    kind: "indexeddb",

    async init() {
      await open();
    },

    async read<T = unknown>(namespace: StoreNamespace, id: string) {
      try {
        const { store, transaction } = await readonlyRecords();
        const record = await store.get(key(namespace, id));
        await transaction.done;
        return record ? (record.v as T) : undefined;
      } catch (error) {
        throw toStorageError(error);
      }
    },

    async list<T = unknown>(namespace: StoreNamespace) {
      try {
        const { store, transaction } = await readonlyRecords();
        const entries = await store.getAll(range(namespace));
        await transaction.done;
        return entries.map((entry) => entry.v as T);
      } catch (error) {
        throw toStorageError(error);
      }
    },

    async write(namespace: StoreNamespace, id: string, value: unknown) {
      await this.writeMany(namespace, [[id, value]]);
    },

    async writeMany(namespace: StoreNamespace, entries: Array<[string, unknown]>) {
      if (entries.length === 0) return;
      try {
        const { store, transaction } = await readwriteRecords();
        // One transaction for the whole batch: a Layer's positions land
        // together, or not at all.
        const puts = entries.map(([id, value]) => store.put({ k: key(namespace, id), v: value }));
        await Promise.all(puts);
        await transaction.done;
      } catch (error) {
        throw toStorageError(error);
      }
    },

    async remove(namespace: StoreNamespace, id: string) {
      await this.removeMany(namespace, [id]);
    },

    async removeMany(namespace: StoreNamespace, ids: string[]) {
      if (ids.length === 0) return;
      try {
        const { store, transaction } = await readwriteRecords();
        await Promise.all(ids.map((id) => store.delete(key(namespace, id))));
        await transaction.done;
      } catch (error) {
        throw toStorageError(error);
      }
    },

    async clear(namespace: StoreNamespace) {
      try {
        const { store, transaction } = await readwriteRecords();
        await store.delete(range(namespace));
        await transaction.done;
      } catch (error) {
        throw toStorageError(error);
      }
    },

    async estimateUsage() {
      try {
        if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
        const estimate = await navigator.storage.estimate();
        return estimate.usage ?? null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Feature probe run before choosing an adapter: a real read+write round trip in
 * a throwaway database, because `typeof indexedDB !== "undefined"` is true even
 * when the browser is about to block every open() call.
 */
export async function isIndexedDbAvailable(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await openDB("layer-probe", 1, {
      upgrade(probe) {
        if (!probe.objectStoreNames.contains("probe")) probe.createObjectStore("probe");
      },
    });
    const transaction = db.transaction("probe", "readwrite");
    await transaction.store.put({ ok: true }, "ok");
    await transaction.done;
    db.close();
    await new Promise<void>((resolve) => {
      const deleted = indexedDB.deleteDatabase("layer-probe");
      deleted.onsuccess = () => resolve();
      deleted.onerror = () => resolve();
      deleted.onblocked = () => resolve();
    });
    return true;
  } catch {
    return false;
  }
}

export function namespaces(): StoreNamespace[] {
  return [...NAMESPACES];
}
