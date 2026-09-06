"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { LayerStore, getLayerStore, type AppState } from "./store";

const StoreContext = createContext<LayerStore | null>(null);

/**
 * Mounts the single store for the tab, boots persistence, and holds the tree
 * behind a gate until the local database has answered.
 *
 * The gate is also what keeps this app SSR-safe: the server renders the boot
 * screen (no IndexedDB exists there), and every data-driven screen mounts on the
 * client right after. That is deliberate for a local-first product — the HTML
 * shell is static, the workspace is real and immediate.
 */
export function StoreProvider({ children }: { children: ReactNode }): ReactNode {
  const store = useMemo(() => getLayerStore(), []);
  // `boot()` is idempotent and the status lives in the store, so the gate is a
  // plain derived value: no local flag to keep in sync.
  const status = useSyncExternalStore(store.subscribe, () => store.getState().status, () => "boot" as const);
  const booting = status === "boot";

  useEffect(() => {
    void store.boot();
  }, [store]);

  return (
    <StoreContext.Provider value={store}>
      {booting ? <BootGate /> : children}
    </StoreContext.Provider>
  );
}

function BootGate(): ReactNode {
  return (
    <div className="grid h-dvh place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-5">
        <div className="layer-mark" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <p className="text-[11px] tracking-[0.3em] text-faint uppercase">Opening LAYER</p>
      </div>
    </div>
  );
}

export function useStore(): LayerStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}

/**
 * Subscribe to one slice of app state.
 *
 * The store exposes a monotonically increasing version, so `getSnapshot` is a
 * number (cheap, referentially stable) and the selector is re-run only when that
 * version changes. A card can therefore subscribe to its own record and a drag
 * somewhere else in the Layer costs it zero renders.
 */
export function useAppState<T>(selector: (state: AppState) => T): T {
  const store = useStore();
  useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return selector(store.getState());
}

/** State + the store, for screens that dispatch a lot of actions. */
export function useLayerState(): { state: AppState; store: LayerStore } {
  const store = useStore();
  useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return { state: store.getState(), store };
}
