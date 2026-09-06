/**
 * Workspace-level data flows: export, import, reset.
 *
 * These are the only operations that touch the whole database at once, so they
 * live outside the store's action set. Everything here is safe against
 * half-finished work: a flush happens first, and imports are validated before a
 * single byte is written.
 */

import {
  applyImport,
  downloadText,
  exportBackup,
  exportLayer,
  parseBackup,
  type ImportPlan,
} from "@/lib/storage/transfer";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/types";
import type { LayerStore } from "./store";
import type { Layer } from "@/lib/types";

export async function exportWorkspace(store: LayerStore, includeMedia: boolean): Promise<void> {
  await store.flush();
  const repository = store.getRepository();
  if (!repository) {
    store.notify("Nothing to export yet.", { tone: "warning" });
    return;
  }
  try {
    const result = await exportBackup(repository, { includeMedia });
    store.notify(
      `Exported ${result.counts.layers} layer${result.counts.layers === 1 ? "" : "s"}, ${result.counts.cards} card${
        result.counts.cards === 1 ? "" : "s"
      }${includeMedia ? ` and ${result.counts.assets} file${result.counts.assets === 1 ? "" : "s"}` : ""} (${(
        result.bytes / 1024
      ).toFixed(0)} KB).`,
      { tone: "success", duration: 7_000 },
    );
  } catch (error) {
    store.notify(error instanceof Error ? error.message : "Export failed.", {
      tone: "danger",
      duration: 8_000,
    });
  }
}

/** Validate a backup file without writing anything. */
export function inspectBackup(text: string): Promise<ImportPlan> {
  return parseBackup(text);
}

export async function commitImport(store: LayerStore, plan: ImportPlan, mode: "merge" | "replace"): Promise<void> {
  const repository = store.getRepository();
  if (!repository) throw new Error("Local storage is not available, so nothing can be imported.");
  await store.flush();
  const summary = await applyImport(repository, plan, mode);
  if (mode === "replace") {
    store.clearObjectUrls();
    const snapshot = await repository.loadSnapshot();
    await store.applySnapshot(snapshot);
  } else {
    const cards = { ...store.getState().cards };
    const order = [...store.getState().cardOrder];
    for (const card of plan.cards) {
      cards[card.id] = card;
      if (!order.includes(card.id)) order.push(card.id);
    }
    const layers = [...store.getState().layers];
    for (const layer of plan.layers) {
      const index = layers.findIndex((candidate) => candidate.id === layer.id);
      if (index >= 0) layers[index] = layer;
      else layers.unshift(layer);
    }
    store.patchState({
      layers,
      cards,
      cardOrder: order,
      settings: { ...store.getState().settings, ...plan.settings } as Settings,
    });
  }
  store.clearObjectUrls();
  store.forgetUndo();
  store.patchState({
    undoDepth: 0,
    importedSummary: `${summary.layers} layers · ${summary.cards} cards · ${summary.assets} files`,
  });
  store.notify(
    `Imported ${summary.layers} layer${summary.layers === 1 ? "" : "s"} and ${summary.cards} card${
      summary.cards === 1 ? "" : "s"
    }.`,
    { tone: "success", duration: 8_000 },
  );
}

/**
 * Single-Layer export: a shareable file that `parseBackup` also accepts, so a
 * Layer can move between machines (or people) without shipping the whole vault.
 */
export async function exportSingleLayer(store: LayerStore, layer: Layer): Promise<void> {
  await store.flush();
  const repository = store.getRepository();
  if (!repository) return;
  try {
    const { filename, json } = await exportLayer(repository, layer);
    downloadText(filename, json);
    store.notify(`Exported “${layer.name}” (cards and positions, no attachments).`, { tone: "success" });
  } catch (error) {
    store.notify(error instanceof Error ? error.message : "Export failed.", { tone: "danger" });
  }
}

export async function resetWorkspace(store: LayerStore): Promise<void> {
  const repository = store.getRepository();
  if (repository) {
    try {
      await repository.wipe();
    } catch (error) {
      store.notify(error instanceof Error ? error.message : "Could not reset local data.", { tone: "danger" });
      return;
    }
  }
  store.clearObjectUrls();
  store.resetWriteBuffers();
  store.patchState({
    layers: [],
    cards: {},
    cardOrder: [],
    openLayerId: null,
    selectedCardId: null,
    editingCardId: null,
    overlay: null,
    layerDialog: null,
    undoDepth: 0,
    importedSummary: null,
    settings: { ...DEFAULT_SETTINGS },
  });
  store.notify("Local data cleared.", { tone: "success" });
}
