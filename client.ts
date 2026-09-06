import { createIndexedDbStore, isIndexedDbAvailable } from "./indexeddb";
import { createLocalStorageStore, isLocalStorageAvailable } from "./localstorage";
import { createMemoryStore } from "./memory";
import { createRepository } from "./repository";
import type { NamespacedStore } from "./types";
import type { StorageInfo } from "@/lib/types/settings";

export type RepositoryHandle = ReturnType<typeof createRepository>;

let handle: RepositoryHandle | null = null;
let opening: Promise<RepositoryHandle> | null = null;

async function chooseStore(): Promise<{ store: NamespacedStore; info: StorageInfo }> {
  if (await isIndexedDbAvailable()) {
    return { store: createIndexedDbStore(), info: { kind: "indexeddb", writable: true } };
  }
  if (await isLocalStorageAvailable()) {
    return {
      store: createLocalStorageStore(),
      info: {
        kind: "localstorage",
        writable: true,
        message: "IndexedDB is blocked in this browser, so LAYER fell back to localStorage (~5 MB cap).",
      },
    };
  }
  return {
    store: createMemoryStore(),
    info: {
      kind: "unavailable",
      writable: false,
      message: "No local storage is available in this browser session. Everything you do now is lost on reload.",
    },
  };
}

/**
 * Single entry point for persistence. Resolves once, on first use, and is
 * reused by every consumer (state layer, settings page, import/export).
 */
export function getRepository(): Promise<RepositoryHandle> {
  if (handle) return Promise.resolve(handle);
  if (!opening) {
    opening = (async () => {
      const { store, info } = await chooseStore();
      const repository = createRepository(store, info);
      await repository.ready();
      handle = repository;
      return repository;
    })().finally(() => {
      opening = null;
    });
  }
  return opening;
}

/** Test seam: drop the cached adapter so a fresh store can be injected. */
export function __resetRepository(next?: RepositoryHandle): void {
  handle = next ?? null;
  opening = null;
}
