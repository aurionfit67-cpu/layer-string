import { normalizeCard, normalizeCards, normalizeLayers, normalizeSettings } from "./normalize";
import type { MediaBlob, MediaDescriptor, NamespacedStore, RawSnapshot, Repository } from "./types";
import { toStorageError } from "./types";
import type { Card } from "@/lib/types/card";
import type { Layer } from "@/lib/types/layer";
import { DEFAULT_SETTINGS, type Settings, type StorageInfo } from "@/lib/types/settings";

const SETTINGS_KEY = "settings";
const FLAG_PREFIX = "flag:";

type MediaRecord = { id: string; mime: string; data: ArrayBuffer | string };

function mediaSize(data: ArrayBuffer | string): number {
  if (typeof data === "string") return Math.round((data.length * 3) / 4);
  return data.byteLength;
}

/** Media attached to a card, if that card is an image or a file. */
export function cardMediaId(card: Card): string {
  return "mediaId" in card.data ? card.data.mediaId : "";
}

/**
 * The only place in the app that knows persistence exists.
 *
 * Responsibilities: address records by namespace, validate everything on read
 * (a half-written or hand-edited record degrades to "dropped", never to
 * "crash"), keep media alive next to the cards that reference it, and hand the
 * state layer one atomic snapshot for boot / export / import.
 *
 * Writes are eager here by design — batching and debouncing are the caller's
 * job (see lib/state/persistence.ts), so the store stays predictable.
 */
export function createRepository(
  store: NamespacedStore,
  initialInfo?: StorageInfo,
): Repository & { flush(): Promise<void> } {
  let info: StorageInfo = initialInfo ?? { kind: store.kind, writable: true };
  let chain: Promise<void> = Promise.resolve();

  const track = (label: string, task: () => Promise<void>): Promise<void> => {
    const run = chain
      .then(task)
      .then(() => {
        // A successful write is proof the store came back: clear the flag.
        if (!info.writable) info = { ...info, writable: true, message: undefined };
      })
      .catch((error: unknown) => {
        const wrapped = toStorageError(error);
        info = { ...info, writable: false, message: wrapped.message };
        if (typeof console !== "undefined") console.warn("[layer] persistence failed:", wrapped.message);
      });
    chain = run;
    return run;
  };

  const repository: Repository & { flush(): Promise<void> } = {
    get info() {
      return info;
    },

    async ready() {
      try {
        await store.init();
        info = { ...info, writable: true };
        return true;
      } catch (error) {
        const wrapped = toStorageError(error);
        info = { ...info, writable: false, message: wrapped.message };
        return false;
      }
    },

    async loadSnapshot(): Promise<RawSnapshot> {
      try {
        const [rawLayers, rawCards, rawSettings, rawMedia] = await Promise.all([
          store.list<unknown>("layers"),
          store.list<unknown>("cards"),
          store.read<unknown>("kv", SETTINGS_KEY),
          store.list<MediaRecord>("media"),
        ]);

        const { layers, dropped: droppedLayers } = normalizeLayers(rawLayers);
        const known = new Set(layers.map((layer) => layer.id));

        const cards: Card[] = [];
        let droppedCards = 0;
        for (const candidate of rawCards) {
          const card = normalizeCard(candidate);
          // A card pointing at a missing Layer is invisible but not destroyed:
          // restoring that Layer (import) brings the cards back.
          if (!card || !known.has(card.layerId)) {
            droppedCards += 1;
            continue;
          }
          cards.push(card);
        }

        const media: MediaDescriptor[] = rawMedia
          .filter((entry) => entry && typeof entry.id === "string" && entry.id.length > 0)
          .map((entry) => ({
            id: entry.id,
            mime: entry.mime || "application/octet-stream",
            size: mediaSize(entry.data),
          }));

        if (droppedLayers > 0 || droppedCards > 0) {
          info = {
            ...info,
            message: `${droppedLayers + droppedCards} unreadable record${
              droppedLayers + droppedCards === 1 ? "" : "s"
            } were skipped.`,
          };
        }

        return {
          layers: layers.sort(
            (a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0) || b.updatedAt - a.updatedAt,
          ),
          cards: cards.sort(
            (a, b) => (a.position.z ?? 0) - (b.position.z ?? 0) || a.createdAt - b.createdAt,
          ),
          settings: normalizeSettings(rawSettings),
          media,
        };
      } catch (error) {
        const wrapped = toStorageError(error);
        info = { ...info, writable: false, message: wrapped.message };
        throw wrapped;
      }
    },

    saveLayer(layer: Layer) {
      return track(`layer:${layer.id}`, () => store.write("layers", layer.id, layer));
    },

    async deleteLayer(id: string) {
      await track(`delete-layer:${id}`, async () => {
        const rawCards = await store.list<unknown>("cards");
        const doomed = rawCards
          .map((candidate) => normalizeCard(candidate))
          .filter((card): card is Card => card !== null && card.layerId === id);
        const mediaIds = [...new Set(doomed.map(cardMediaId).filter(Boolean))];
        await Promise.all([
          store.removeMany(
            "cards",
            doomed.map((card) => card.id),
          ),
          store.removeMany("media", mediaIds),
          store.remove("layers", id),
        ]);
      });
    },

    saveCards(cards: Card[]) {
      if (cards.length === 0) return Promise.resolve();
      return track(`cards:${cards.length}`, async () => {
        await store.writeMany(
          "cards",
          cards.map((card) => [card.id, card]),
        );
      });
    },

    async deleteCards(ids: string[]) {
      if (ids.length === 0) return;
      await track(`delete-cards:${ids.length}`, async () => {
        const rawCards = await store.list<unknown>("cards");
        const doomed = rawCards
          .map((candidate) => normalizeCard(candidate))
          .filter((card): card is Card => card !== null && ids.includes(card.id));
        const mediaIds = [...new Set(doomed.map(cardMediaId).filter(Boolean))];
        await Promise.all([
          store.removeMany("cards", ids),
          store.removeMany("media", mediaIds),
        ]);
      });
    },

    saveSettings(settings: Settings) {
      return track("settings", () => store.write("kv", SETTINGS_KEY, settings));
    },

    saveFlag(key: string, value: unknown) {
      return track(`flag:${key}`, () => store.write("kv", `${FLAG_PREFIX}${key}`, value));
    },

    async loadFlag<T>(key: string) {
      try {
        return await store.read<T>("kv", `${FLAG_PREFIX}${key}`);
      } catch {
        return undefined;
      }
    },

    async putMedia(media: MediaBlob) {
      await track(`media:${media.id}`, () =>
        store.write("media", media.id, {
          id: media.id,
          mime: media.mime || "application/octet-stream",
          data: media.data,
        } satisfies MediaRecord),
      );
    },

    async getMedia(id: string) {
      if (!id) return undefined;
      try {
        const record = await store.read<MediaRecord>("media", id);
        if (!record) return undefined;
        return {
          id: record.id ?? id,
          mime: record.mime || "application/octet-stream",
          data: record.data,
        };
      } catch (error) {
        const wrapped = toStorageError(error);
        info = { ...info, writable: false, message: wrapped.message };
        return undefined;
      }
    },

    deleteMedia(ids: string[]) {
      const unique = [...new Set(ids.filter(Boolean))];
      if (unique.length === 0) return Promise.resolve();
      return track(`delete-media:${unique.length}`, () => store.removeMany("media", unique));
    },

    async replaceAll(snapshot: RawSnapshot, media: MediaBlob[]) {
      await track("replace-all", async () => {
        const { layers } = normalizeLayers(snapshot.layers);
        const { cards } = normalizeCards(snapshot.cards);
        await Promise.all([
          store.clear("layers"),
          store.clear("cards"),
          store.clear("media"),
          store.clear("kv"),
        ]);
        if (media.length > 0) {
          await store.writeMany(
            "media",
            media.map((entry) => [entry.id, { id: entry.id, mime: entry.mime, data: entry.data }]),
          );
        }
        await store.writeMany(
          "layers",
          layers.map((layer) => [layer.id, layer]),
        );
        await store.writeMany(
          "cards",
          cards.map((card) => [card.id, card]),
        );
        await store.write("kv", SETTINGS_KEY, snapshot.settings ?? DEFAULT_SETTINGS);
        info = { ...info, writable: true, message: undefined };
      });
    },

    async mergeInto(layersIn: Layer[], cardsIn: Card[], settingsPatch?: Partial<Settings>) {
      await track("merge", async () => {
        const { layers } = normalizeLayers(layersIn);
        const { cards } = normalizeCards(cardsIn);
        if (layers.length > 0) {
          await store.writeMany(
            "layers",
            layers.map((layer) => [layer.id, layer]),
          );
        }
        if (cards.length > 0) {
          await store.writeMany(
            "cards",
            cards.map((card) => [card.id, card]),
          );
        }
        if (settingsPatch) {
          const current = normalizeSettings(await store.read("kv", SETTINGS_KEY));
          await store.write("kv", SETTINGS_KEY, { ...current, ...settingsPatch });
        }
      });
    },

    async wipe() {
      await track("wipe", async () => {
        await Promise.all([
          store.clear("layers"),
          store.clear("cards"),
          store.clear("media"),
          store.clear("kv"),
        ]);
        await store.write("kv", SETTINGS_KEY, DEFAULT_SETTINGS);
      });
    },

    async estimateUsageBytes() {
      try {
        return await store.estimateUsage();
      } catch {
        return null;
      }
    },

    /** Wait for every queued write. Used before export and on pagehide. */
    async flush() {
      await chain;
    },
  };

  return repository;
}

export type RepositoryWithFlush = ReturnType<typeof createRepository>;
