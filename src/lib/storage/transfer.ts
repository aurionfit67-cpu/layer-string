import { arrayBufferToBase64, base64ToArrayBuffer } from "./base64";
import { cardMediaId } from "./repository";
import type { Repository } from "./types";
import type { MediaBlob } from "./types";
import { normalizeCard, normalizeLayers, normalizeSettings } from "./normalize";
import type { Card } from "@/lib/types/card";
import type { Layer } from "@/lib/types/layer";
import { SCHEMA_VERSION, type ExportFile, type ImportSummary, type Settings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

export const EXPORT_FILENAME = "layer-backup.json";
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
export const MAX_IMPORT_BYTES = 64 * 1024 * 1024;

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

export type ImportPlan = {
  layers: Layer[];
  cards: Card[];
  settings: Partial<Settings>;
  media: MediaBlob[];
  exportedAt?: string;
  warnings: string[];
  /** Cards whose media was not in the file (media-free backup). */
  danglingMedia: number;
  skippedRecords: number;
};

/** Serialise the whole workspace, optionally embedding image/file bytes. */
export async function buildExportFile(
  repository: Repository,
  options: { includeMedia: boolean },
): Promise<{ file: ExportFile; json: string }> {
  const snapshot = await repository.loadSnapshot();
  const usedMedia = new Set<string>();
  for (const card of snapshot.cards) {
    const id = cardMediaId(card);
    if (id) usedMedia.add(id);
  }

  const assets: ExportFile["assets"] = options.includeMedia ? {} : undefined;
  let included = 0;
  if (assets) {
    for (const descriptor of snapshot.media) {
      if (!usedMedia.has(descriptor.id)) continue;
      if (descriptor.size > MAX_ASSET_BYTES) {
        assets[descriptor.id] = { mime: descriptor.mime, size: descriptor.size, data: "" };
        continue;
      }
      const blob = await repository.getMedia(descriptor.id);
      if (!blob) continue;
      const base64 =
        typeof blob.data === "string"
          ? blob.data
          : await arrayBufferToBase64(blob.data as ArrayBuffer);
      assets[descriptor.id] = { mime: blob.mime, size: descriptor.size, data: base64 };
      included += 1;
    }
  }

  const file: ExportFile = {
    app: "layer",
    kind: "backup",
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      layers: snapshot.layers.length,
      cards: snapshot.cards.length,
      assets: included,
    },
    layers: snapshot.layers,
    cards: snapshot.cards,
    assets,
    settings: snapshot.settings,
  };

  return { file, json: `${JSON.stringify(file, null, 2)}\n` };
}

export function downloadText(filename: string, text: string, mime = "application/json"): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next task so the download has definitely started.
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export async function exportBackup(
  repository: Repository,
  options: { includeMedia: boolean },
): Promise<{ filename: string; bytes: number; counts: ExportFile["counts"] }> {
  const { file, json } = await buildExportFile(repository, options);
  downloadText(EXPORT_FILENAME, json);
  return {
    filename: EXPORT_FILENAME,
    bytes: new Blob([json]).size,
    counts: file.counts,
  };
}

/**
 * Parse + validate an uploaded backup.
 *
 * Never trusts the file: structure is checked, every record goes through the
 * same normalisers as storage reads, oversized or unreadable assets are dropped
 * with a warning rather than thrown away silently or trusted blindly.
 */
export async function parseBackup(text: string): Promise<ImportPlan> {
  if (text.length > MAX_IMPORT_BYTES) {
    throw new ImportError(`That file is too large to import (over ${MAX_IMPORT_BYTES / 1024 / 1024} MB).`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError("That file isn't valid JSON, so it can't be imported.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ImportError("Expected a LAYER backup object, found something else.");
  }

  const raw = parsed as Record<string, unknown>;
  const warnings: string[] = [];

  const isSingleLayer = raw.kind === "layer-export-selection";

  if (raw.app !== "layer" && !isSingleLayer) {
    if (!Array.isArray(raw.layers) || !Array.isArray(raw.cards)) {
      throw new ImportError("This isn't a LAYER backup file. Expected a file exported from LAYER settings.");
    }
    warnings.push("The file had no LAYER header; it was imported on a best-effort basis.");
  }

  const version = typeof raw.version === "number" ? raw.version : 0;
  if (version > SCHEMA_VERSION) {
    throw new ImportError(
      `That backup uses schema v${version}, which this build of LAYER can't read. Update LAYER and try again.`,
    );
  }
  if (version !== SCHEMA_VERSION && version > 0) {
    warnings.push(`Backup schema v${version} was upgraded to v${SCHEMA_VERSION} while importing.`);
  }

  // Two shapes are accepted: a full workspace backup, and a single-Layer export
  // (the Layer menu's "Export Layer"), which carries one layer + its cards.
  const rawLayers = isSingleLayer
    ? [raw.layer]
    : Array.isArray(raw.layers)
      ? raw.layers
      : (() => {
          throw new ImportError("This backup has no layers array.");
        })();
  const rawCards = Array.isArray(raw.cards) ? raw.cards : [];

  const { layers, dropped: droppedLayers } = normalizeLayers(rawLayers);
  const cards: Card[] = [];
  let droppedCards = 0;
  for (const candidate of rawCards) {
    const card = normalizeCard(candidate);
    if (!card) {
      droppedCards += 1;
      continue;
    }
    cards.push(card);
  }

  // Drop cards that point at a Layer this file doesn't contain, so the
  // workspace never renders a card it can't show.
  const layerIds = new Set(layers.map((layer) => layer.id));
  const attached = cards.filter((card) => layerIds.has(card.layerId));
  const orphans = cards.length - attached.length;
  if (orphans > 0) warnings.push(`${orphans} card${orphans === 1 ? "" : "s"} referenced a missing Layer and were skipped.`);
  if (droppedLayers > 0) warnings.push(`${droppedLayers} unreadable layer${droppedLayers === 1 ? "" : "s"} were skipped.`);
  if (droppedCards > 0) warnings.push(`${droppedCards} unreadable card${droppedCards === 1 ? "" : "s"} were skipped.`);

  const media: MediaBlob[] = [];
  let danglingMedia = 0;
  const assets = raw.assets;
  const wantedMedia = new Set(attached.map(cardMediaId).filter(Boolean));
  if (assets && typeof assets === "object" && !Array.isArray(assets)) {
    for (const [id, value] of Object.entries(assets as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) continue;
      const entry = value as Record<string, unknown>;
      const data = typeof entry.data === "string" ? entry.data : "";
      if (!data) {
        if (wantedMedia.has(id)) danglingMedia += 1;
        continue;
      }
      const approxBytes = Math.round((data.length * 3) / 4);
      if (approxBytes > MAX_ASSET_BYTES) {
        warnings.push(`Skipped an oversized asset (${id}).`);
        continue;
      }
      try {
        media.push({
          id,
          mime: typeof entry.mime === "string" ? entry.mime.slice(0, 80) : "application/octet-stream",
          data: base64ToArrayBuffer(data),
        });
      } catch {
        warnings.push(`Skipped a corrupted asset (${id}).`);
      }
    }
  }
  if (danglingMedia > 0) {
    warnings.push(`${danglingMedia} image/file card${danglingMedia === 1 ? "" : "s"} were imported without their bytes.`);
  }

  return {
    layers,
    cards: attached,
    settings: normalizeSettings(raw.settings),
    media,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : undefined,
    warnings,
    danglingMedia,
    skippedRecords: droppedLayers + droppedCards + orphans,
  };
}

export async function applyImport(
  repository: Repository,
  plan: ImportPlan,
  mode: "merge" | "replace",
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    mode,
    layers: plan.layers.length,
    cards: plan.cards.length,
    assets: plan.media.length,
    skipped: plan.skippedRecords,
    warnings: plan.warnings,
  };

  if (mode === "replace") {
    await repository.replaceAll(
      {
        layers: plan.layers,
        cards: plan.cards,
        settings: { ...DEFAULT_SETTINGS, ...plan.settings },
        media: [],
      },
      plan.media,
    );
    return summary;
  }

  await repository.mergeInto(plan.layers, plan.cards, plan.settings);
  for (const media of plan.media) {
    try {
      await repository.putMedia(media);
    } catch {
      summary.warnings = [...summary.warnings, "Some attached files could not be stored."];
      break;
    }
  }
  return summary;
}

/** Export a single Layer (Settings and the Layer menu both offer this). */
export async function exportLayer(
  repository: Repository,
  layer: Layer,
): Promise<{ filename: string; json: string }> {
  const snapshot = await repository.loadSnapshot();
  const cards = snapshot.cards.filter((card) => card.layerId === layer.id);
  const filename = `layer-${layer.id}.json`;
  const file = {
    app: "layer" as const,
    kind: "layer-export-selection" as const,
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    layer,
    cards,
  };
  return { filename, json: `${JSON.stringify(file, null, 2)}\n` };
}
