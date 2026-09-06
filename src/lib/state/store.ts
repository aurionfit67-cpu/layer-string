import type { Card, CardKind, CardOf, CardPosition, Layer, Settings, StorageInfo } from "@/lib/types";
import { CARD_DEFAULT_WIDTH, GRID_SIZE, snapToGrid } from "@/lib/types";
import { DEFAULT_SETTINGS, emptyCardData } from "@/lib/types";
import type { NewLayer, ViewMode } from "@/lib/types";
import { getRepository, type RepositoryHandle } from "@/lib/storage/client";
import { cardMediaId } from "@/lib/storage/repository";
import { createId, stableId } from "@/lib/utils/ids";
import { MAX_BODY, MAX_DESCRIPTION, MAX_NAME, MAX_TITLE } from "@/lib/utils/format";
import { sanitizeLine, sanitizeText } from "@/lib/utils/sanitize";
import type { Camera } from "@/lib/workspace/camera";
import { DEMO_CARDS, DEMO_LAYER } from "./demo";
import { cardRect } from "@/lib/workspace/geometry";

export type OverlayName = "palette" | "search" | "shortcuts" | "layer-dialog" | null;
export type NoticeTone = "info" | "success" | "warning" | "danger";

export type Notice = {
  id: number;
  tone: NoticeTone;
  text: string;
  action?: { label: string; run: () => void };
};

export type UndoEntry =
  | { kind: "delete-card"; card: Card }
  | { kind: "add-card"; cardId: string }
  | { kind: "delete-layer"; layer: Layer; cards: Card[] }
  | { kind: "move-card"; cardId: string; from: CardPosition; to: CardPosition };

export type LayerDialogState = { mode: "create"; name?: string } | { mode: "edit"; layerId: string } | null;

export type AppState = {
  status: "boot" | "ready" | "error";
  /** Fatal boot failure text (storage refused to open at all). */
  fatalError: string | null;
  storage: StorageInfo;
  settings: Settings;
  layers: Layer[];
  cards: Record<string, Card>;
  cardOrder: string[];
  openLayerId: string | null;
  selectedCardId: string | null;
  editingCardId: string | null;
  overlay: OverlayName;
  layerDialog: LayerDialogState;
  notice: Notice | null;
  /** Card to scroll to and flash, set by palette/search navigation. */
  focusCardId: string | null;
  /** Set before a route change; consumed once the target Layer has mounted. */
  revealTarget: { layerId: string; cardId: string } | null;
  /** Incremented by the "+ Add" flow to open the image/file pickers. */
  mediaRequest: { id: number; kind: "image" | "file"; accept: string } | null;
  undoDepth: number;
  pendingWrites: number;
  importedSummary: string | null;
};

const EMPTY_STATE: AppState = {
  status: "boot",
  fatalError: null,
  storage: { kind: "unavailable", writable: false },
  settings: { ...DEFAULT_SETTINGS },
  layers: [],
  cards: {},
  cardOrder: [],
  openLayerId: null,
  selectedCardId: null,
  editingCardId: null,
  overlay: null,
  layerDialog: null,
  notice: null,
  focusCardId: null,
  revealTarget: null,
  mediaRequest: null,
  undoDepth: 0,
  pendingWrites: 0,
  importedSummary: null,
};

type Listener = () => void;

type InsertInit = {
  title?: string;
  data?: Record<string, unknown>;
  position?: Partial<CardPosition>;
  seed?: string;
  demo?: boolean;
  edit?: boolean;
};

const PERSIST_DELAY_MS = 400;
const MAX_UNDO = 20;

/**
 * The application store: one mutable object, one version counter, synchronous
 * in-memory updates and asynchronous, coalesced persistence.
 *
 * Two rules keep LAYER feeling instant:
 *  1. UI state is never blocked on IndexedDB. Every mutation lands in memory
 *     first, and the write is queued behind a short debounce.
 *  2. The workspace viewport is not stored here at all — the Camera instance is
 *     registered by the canvas so reads (zoom % badge, "add at centre") can
 *     happen without a render.
 */
export class LayerStore {
  private state: AppState = { ...EMPTY_STATE };
  private listeners = new Set<Listener>();
  private version = 0;
  private repository: RepositoryHandle | null = null;
  private bootPromise: Promise<void> | null = null;
  private camera: Camera | null = null;
  private objectUrls = new Map<string, string>();
  private dirtyCards = new Set<string>();
  private dirtyLayers = new Set<string>();
  private removedCards = new Set<string>();
  private removedLayers = new Set<string>();
  private removedMedia = new Set<string>();
  private settingsDirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private focusTimer: ReturnType<typeof setTimeout> | null = null;
  private undoStack: UndoEntry[] = [];
  private lifecycleBound = false;

  // --------------------------------------------------------------- plumbing

  getState = (): AppState => this.state;

  getVersion = (): number => this.version;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.version += 1;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  /** The canvas registers its camera so the store can read/modify the view. */
  attachCamera(camera: Camera | null): void {
    this.camera = camera;
  }

  getCamera(): Camera | null {
    return this.camera;
  }

  // ------------------------------------------------------------------ boot

  boot(): Promise<void> {
    if (!this.bootPromise) {
      this.bootPromise = this.doBoot();
    }
    return this.bootPromise;
  }

  private async doBoot(): Promise<void> {
    try {
      const repository = await getRepository();
      this.repository = repository;
      this.set({ storage: repository.info });
      const snapshot = await repository.loadSnapshot();
      const cards: Record<string, Card> = {};
      const order: string[] = [];
      for (const card of snapshot.cards) {
        cards[card.id] = card;
        order.push(card.id);
      }
      this.set({
        status: "ready",
        settings: snapshot.settings,
        layers: snapshot.layers,
        cards,
        cardOrder: order,
        storage: repository.info,
      });
      this.bindLifecycle();
    } catch (error) {
      this.set({
        status: "error",
        fatalError:
          error instanceof Error
            ? error.message
            : "LAYER could not open local storage in this browser.",
      });
    }
  }

  private bindLifecycle(): void {
    if (this.lifecycleBound || typeof window === "undefined") return;
    this.lifecycleBound = true;
    const flush = () => void this.flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  // -------------------------------------------------------------- reading

  layerById(id: string | null | undefined): Layer | undefined {
    if (!id) return undefined;
    return this.state.layers.find((layer) => layer.id === id);
  }

  cardsOf(layerId: string): Card[] {
    const out: Card[] = [];
    for (const id of this.state.cardOrder) {
      const card = this.state.cards[id];
      if (card && card.layerId === layerId) out.push(card);
    }
    return out;
  }

  // ------------------------------------------------------------- persistence

  private queueCards(ids: string[]): void {
    for (const id of ids) this.dirtyCards.add(id);
    this.scheduleFlush();
  }

  private queueLayers(ids: string[]): void {
    for (const id of ids) this.dirtyLayers.add(id);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.state.pendingWrites === 0) this.set({ pendingWrites: 1 });
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, PERSIST_DELAY_MS);
  }

  /** Write everything the store has accumulated. Awaited by export + tests. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const repository = this.repository;
    if (!repository) {
      this.set({ pendingWrites: 0 });
      return;
    }
    const cards = [...this.dirtyCards]
      .map((id) => this.state.cards[id])
      .filter((card): card is Card => Boolean(card));
    const layers = [...this.dirtyLayers]
      .map((id) => this.layerById(id))
      .filter((layer): layer is Layer => Boolean(layer));
    const deadCards = [...this.removedCards];
    const deadLayers = [...this.removedLayers];
    const deadMedia = [...this.removedMedia];
    const settings = this.settingsDirty ? this.state.settings : null;

    this.dirtyCards.clear();
    this.dirtyLayers.clear();
    this.removedCards.clear();
    this.removedLayers.clear();
    this.removedMedia.clear();
    this.settingsDirty = false;

    try {
      if (deadLayers.length > 0) {
        await Promise.all(deadLayers.map((id) => repository.deleteLayer(id)));
      }
      if (deadCards.length > 0) await repository.deleteCards(deadCards);
      if (deadMedia.length > 0) await repository.deleteMedia(deadMedia);
      if (layers.length > 0) await Promise.all(layers.map((layer) => repository.saveLayer(layer)));
      if (cards.length > 0) await repository.saveCards(cards);
      if (settings) await repository.saveSettings(settings);
      await repository.flush();
      if (repository.info.message !== this.state.storage.message) {
        this.set({ storage: { ...repository.info }, pendingWrites: 0 });
      } else {
        this.set({ pendingWrites: 0 });
      }
    } catch (error) {
      this.set({
        storage: {
          ...this.state.storage,
          writable: false,
          message: error instanceof Error ? error.message : "Local storage write failed.",
        },
        pendingWrites: 0,
      });
    }
  }

  // ---------------------------------------------------------------- layers

  async createLayer(input: NewLayer): Promise<Layer> {
    const now = Date.now();
    const name = sanitizeLine(input.name, MAX_NAME) || "Untitled Layer";
    const layer: Layer = {
      id: createId("lyr"),
      name,
      description: sanitizeLine(input.description, MAX_DESCRIPTION) || undefined,
      icon: input.icon || undefined,
      accent: input.accent || undefined,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      viewport: { x: 0, y: 0, scale: 1, mode: "canvas" },
      metadata: { source: input.metadata?.source ?? "manual" },
    };
    const layers = [layer, ...this.state.layers];
    this.set({ layers, layerDialog: null });
    this.queueLayers([layer.id]);
    if (input.metadata?.demo) this.markDemo(layer.id);
    return layer;
  }

  private markDemo(layerId: string): void {
    const layer = this.layerById(layerId);
    if (!layer) return;
    this.set({
      layers: this.state.layers.map((candidate) =>
        candidate.id === layerId ? { ...candidate, metadata: { ...candidate.metadata, demo: true } } : candidate,
      ),
    });
  }

  updateLayer(id: string, patch: Partial<Pick<Layer, "name" | "description" | "icon" | "accent">>): void {
    let touched = false;
    const layers = this.state.layers.map((layer) => {
      if (layer.id !== id) return layer;
      touched = true;
      const next: Layer = { ...layer, updatedAt: Date.now() };
      if (patch.name !== undefined) {
        const name = sanitizeLine(patch.name, MAX_NAME);
        if (name) next.name = name;
      }
      if (patch.description !== undefined) {
        const description = sanitizeLine(patch.description, MAX_DESCRIPTION);
        next.description = description || undefined;
      }
      if (patch.icon !== undefined) next.icon = patch.icon || undefined;
      if (patch.accent !== undefined) next.accent = patch.accent || undefined;
      return next;
    });
    if (!touched) return;
    this.set({ layers });
    this.queueLayers([id]);
  }

  setLayerViewport(id: string, viewport: { x: number; y: number; scale: number; mode?: ViewMode }): void {
    const layers = this.state.layers.map((layer) =>
      layer.id === id
        ? {
            ...layer,
            viewport: {
              x: Math.round(viewport.x),
              y: Math.round(viewport.y),
              scale: Number(viewport.scale.toFixed(4)),
              mode: viewport.mode ?? layer.viewport?.mode ?? "canvas",
            },
          }
        : layer,
    );
    this.set({ layers });
    this.queueLayers([id]);
  }

  setViewMode(id: string, mode: ViewMode): void {
    const layer = this.layerById(id);
    this.setLayerViewport(id, {
      x: layer?.viewport?.x ?? 0,
      y: layer?.viewport?.y ?? 0,
      scale: layer?.viewport?.scale ?? 1,
      mode,
    });
  }

  markLayerOpened(id: string): void {
    const now = Date.now();
    const layers = this.state.layers
      .map((layer) => (layer.id === id ? { ...layer, lastOpenedAt: now } : layer))
      .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0) || b.updatedAt - a.updatedAt);
    this.set({ layers });
    this.queueLayers([id]);
  }

  openLayer(id: string): void {
    if (!this.layerById(id)) return;
    this.set({ openLayerId: id, selectedCardId: null, editingCardId: null, overlay: null });
    this.markLayerOpened(id);
  }

  closeLayer(): void {
    this.set({ openLayerId: null, selectedCardId: null, editingCardId: null });
  }

  async deleteLayer(id: string): Promise<void> {
    const layer = this.layerById(id);
    if (!layer) return;
    const cards = this.cardsOf(id);
    const cardsLeft = { ...this.state.cards };
    for (const card of cards) delete cardsLeft[card.id];
    this.set({
      layers: this.state.layers.filter((candidate) => candidate.id !== id),
      cards: cardsLeft,
      cardOrder: this.state.cardOrder.filter((cardId) => cardsLeft[cardId] !== undefined),
      openLayerId: this.state.openLayerId === id ? null : this.state.openLayerId,
      selectedCardId: null,
      editingCardId: null,
    });
    this.removedLayers.add(id);
    this.pushUndo({ kind: "delete-layer", layer, cards });
    await this.flush();
    this.notify(`Layer “${layer.name}” deleted`, { tone: "info", actionLabel: "Undo", action: () => this.undo() });
  }

  async duplicateLayer(id: string): Promise<Layer | null> {
    const source = this.layerById(id);
    if (!source) return null;
    const now = Date.now();
    const newLayerId = createId("lyr");
    const copy: Layer = {
      ...source,
      id: newLayerId,
      name: sanitizeLine(`${source.name} copy`, MAX_NAME),
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: undefined,
      metadata: { ...source.metadata, source: "manual", demo: false },
    };
    const cards = this.cardsOf(id).map((card, index): Card => {
      const position = card.position;
      return {
        ...card,
        id: createId("crd"),
        layerId: newLayerId,
        createdAt: now,
        updatedAt: now,
        position: { ...position, x: position.x + 48, y: position.y + 40 + index * 4 },
        metadata: { ...card.metadata, source: "manual", demo: false },
      };
    });
    this.set({
      layers: [copy, ...this.state.layers],
      cards: { ...this.state.cards, ...Object.fromEntries(cards.map((card) => [card.id, card])) },
      cardOrder: [...this.state.cardOrder, ...cards.map((card) => card.id)],
    });
    this.queueLayers([copy.id]);
    this.queueCards(cards.map((card) => card.id));
    return copy;
  }

  // ----------------------------------------------------------------- cards

  /** Place a new card near the middle of what the user is looking at. */
  private nextPosition(layerId: string, preferred?: Partial<CardPosition>): CardPosition {
    const existing = this.cardsOf(layerId);
    const snap = this.state.settings.snapToGrid;
    const grid = this.state.settings.gridSize || GRID_SIZE;
    const place = (value: number) => (snap ? snapToGrid(value, grid) : Math.round(value));

    if (preferred?.x !== undefined || preferred?.y !== undefined) {
      return {
        x: place(preferred.x ?? 0),
        y: place(preferred.y ?? 0),
        width: preferred.width,
        height: preferred.height,
        z: existing.length + 1,
      };
    }

    const bounds = this.camera?.getBounds();
    const viewport = this.camera?.getViewport();
    const centreX = bounds && viewport ? (bounds.width / 2 - viewport.x) / viewport.scale : 0;
    const centreY = bounds && viewport ? (bounds.height / 2 - viewport.y) / viewport.scale : 0;

    // Nudge until the new card doesn't sit exactly on top of an old one.
    let x = centreX - CARD_DEFAULT_WIDTH / 2;
    let y = centreY - 90;
    const occupied = existing.map((card) => ({
      x: card.position.x,
      y: card.position.y,
      width: card.position.width ?? CARD_DEFAULT_WIDTH,
      height: card.position.height ?? 180,
    }));
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const candidate = { x: place(x), y: place(y), width: CARD_DEFAULT_WIDTH, height: 180 };
      const clash = occupied.some(
        (rect) =>
          candidate.x < rect.x + rect.width &&
          candidate.x + candidate.width > rect.x &&
          candidate.y < rect.y + rect.height &&
          candidate.y + candidate.height > rect.y,
      );
      if (!clash) {
        return { x: candidate.x, y: candidate.y, z: existing.length + 1 };
      }
      x += 28;
      y += 28;
    }
    return { x: place(x), y: place(y), z: existing.length + 1 };
  }

  addCard<K extends CardKind>(
    layerId: string,
    kind: K,
    init: {
      title?: string;
      data?: Partial<CardOf<K>["data"]>;
      position?: Partial<CardPosition>;
      seed?: string;
      demo?: boolean;
      edit?: boolean;
    } = {},
  ): CardOf<K> {
    return this.insertCard(layerId, kind, init as InsertInit) as CardOf<K>;
  }

  /**
   * The one place a card is built. Payloads arrive loosely typed (from the demo
   * seeder and the file picker) and are merged over the kind's defaults, so no
   * caller can produce a half-shaped card.
   */
  private insertCard(
    layerId: string,
    kind: CardKind,
    init: InsertInit = {},
  ): Card {
    const now = Date.now();
    const id = init.seed ? stableId(init.seed) : createId("crd");
    const position = this.nextPosition(layerId, init.position);
    const card = {
      id,
      layerId,
      kind,
      title: sanitizeLine(init.title, MAX_TITLE),
      position: init.position?.width ? { ...position, width: init.position.width } : position,
      createdAt: now,
      updatedAt: now,
      metadata: {
        source: init.demo ? ("demo" as const) : ("manual" as const),
        ...(init.demo ? { demo: true } : {}),
      },
      data: { ...emptyCardData(kind), ...(init.data ?? {}) },
    } as Card;

    const cards = { ...this.state.cards, [id]: card };
    this.set({
      cards,
      cardOrder: this.state.cardOrder.includes(id) ? this.state.cardOrder : [...this.state.cardOrder, id],
      selectedCardId: id,
      editingCardId: init.edit === false ? this.state.editingCardId : id,
      focusCardId: id,
    });
    this.queueCards([id]);
    this.queueLayers([layerId]);
    this.pushUndo({ kind: "add-card", cardId: id });
    this.clearFocusSoon();
    return card;
  }

  /** Remove a card without offering an undo (used when undoing an add). */
  private removeCardSilently(id: string): void {
    const card = this.state.cards[id];
    if (!card) return;
    const cards = { ...this.state.cards };
    delete cards[id];
    this.set({ cards, cardOrder: this.state.cardOrder.filter((candidate) => candidate !== id) });
    this.queueLayers([card.layerId]);
    void this.flush();
  }

  updateCard(
    id: string,
    patch: {
      title?: string;
      body?: string;
      data?: Partial<Card["data"]>;
      position?: Partial<CardPosition>;
    },
  ): void {
    const current = this.state.cards[id];
    if (!current) return;
    const next = { ...current, updatedAt: Date.now() } as Card;
    if (patch.title !== undefined) {
      (next as { title: string }).title = sanitizeLine(patch.title, MAX_TITLE);
    }
    if (patch.body !== undefined && next.kind === "note") {
      next.data = { ...next.data, body: sanitizeText(patch.body, MAX_BODY) };
    }
    if (patch.data) {
      // URLs are stored as typed and validated where they become an href, so a
      // half-written address is never silently thrown away.
      const url = (patch.data as { url?: unknown }).url;
      const merged = { ...next.data, ...patch.data } as Card["data"];
      if (next.kind === "link" && typeof url === "string") {
        (merged as { url: string }).url = sanitizeLine(url, 2048);
      }
      next.data = merged;
    }
    if (patch.position) {
      next.position = { ...next.position, ...patch.position };
    }
    this.set({ cards: { ...this.state.cards, [id]: next } });
    this.queueCards([id]);
    this.queueLayers([current.layerId]);
  }

  /** Drag commit. Deliberately does not touch updatedAt: a move is not an edit. */
  moveCard(id: string, position: CardPosition): void {
    const current = this.state.cards[id];
    if (!current) return;
    const from = current.position;
    if (from.x === position.x && from.y === position.y) return;
    this.set({
      cards: { ...this.state.cards, [id]: { ...current, position: { ...from, ...position } } },
    });
    this.queueCards([id]);
    this.queueLayers([current.layerId]);
    this.pushUndo({ kind: "move-card", cardId: id, from, to: { ...position } });
  }

  deleteCard(id: string): void {
    const card = this.state.cards[id];
    if (!card) return;
    const cards = { ...this.state.cards };
    delete cards[id];
    const mediaId = cardMediaId(card);
    if (mediaId) {
      this.removedMedia.add(mediaId);
      const url = this.objectUrls.get(mediaId);
      if (url) {
        URL.revokeObjectURL(url);
        this.objectUrls.delete(mediaId);
      }
    }
    this.set({
      cards,
      cardOrder: this.state.cardOrder.filter((candidate) => candidate !== id),
      selectedCardId: this.state.selectedCardId === id ? null : this.state.selectedCardId,
      editingCardId: this.state.editingCardId === id ? null : this.state.editingCardId,
    });
    this.removedCards.add(id);
    this.queueLayers([card.layerId]);
    this.pushUndo({ kind: "delete-card", card });
    this.notify("Card deleted", { tone: "info", actionLabel: "Undo", action: () => this.undo() });
  }

  duplicateCard(id: string): void {
    const card = this.state.cards[id];
    if (!card) return;
    const now = Date.now();
    const copy = {
      ...card,
      id: createId("crd"),
      createdAt: now,
      updatedAt: now,
      position: { ...card.position, x: card.position.x + 32, y: card.position.y + 32, z: undefined },
      metadata: { ...card.metadata, source: "manual" as const, demo: false },
    };
    this.set({ cards: { ...this.state.cards, [copy.id]: copy as Card }, cardOrder: [...this.state.cardOrder, copy.id] });
    this.queueCards([copy.id]);
    this.notify("Card duplicated");
  }

  toggleTask(id: string): void {
    const card = this.state.cards[id];
    if (!card || card.kind !== "task") return;
    this.updateCard(id, { data: { done: !card.data.done } });
  }

  setCardWidth(id: string, width: number): void {
    const card = this.state.cards[id];
    if (!card) return;
    this.set({
      cards: {
        ...this.state.cards,
        [id]: { ...card, position: { ...card.position, width: Math.round(width) } },
      },
    });
    this.queueCards([id]);
  }

  bringToFront(id: string): void {
    const card = this.state.cards[id];
    if (!card) return;
    const maxZ = this.cardsOf(card.layerId).reduce((acc, candidate) => Math.max(acc, candidate.position.z ?? 0), 0);
    if ((card.position.z ?? 0) === maxZ) return;
    this.set({ cards: { ...this.state.cards, [id]: { ...card, position: { ...card.position, z: maxZ + 1 } } } });
    this.queueCards([id]);
  }

  /** Re-probe the durable store after a failure (used by the storage banner). */
  async retryStorage(): Promise<void> {
    const repository = this.repository ?? (await getRepository());
    this.repository = repository;
    await repository.saveSettings(this.state.settings);
    const ok = repository.info.writable;
    this.set({ storage: { ...repository.info }, status: "ready" });
    this.notify(
      ok ? "Local storage is writable again." : "Still unable to write. Export your data to keep it safe.",
      { tone: ok ? "success" : "danger", duration: ok ? 4_000 : 9_000 },
    );
  }

  // ------------------------------------------------------------------ undo

  private pushUndo(entry: UndoEntry): void {
    this.undoStack = [...this.undoStack.slice(-(MAX_UNDO - 1)), entry];
    this.set({ undoDepth: this.undoStack.length });
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  undoLabel(): string | null {
    const entry = this.undoStack[this.undoStack.length - 1];
    if (!entry) return null;
    switch (entry.kind) {
      case "delete-card":
        return `Restore ${entry.card.kind} card`;
      case "add-card":
        return "Remove new card";
      case "delete-layer":
        return `Restore “${entry.layer.name}”`;
      case "move-card":
        return "Move card back";
      default:
        return null;
    }
  }

  undo(): void {
    const entry = this.undoStack.pop();
    if (!entry) {
      this.notify("Nothing to undo", { tone: "info" });
      return;
    }
    switch (entry.kind) {
      case "delete-card": {
        this.set({
          cards: { ...this.state.cards, [entry.card.id]: entry.card },
          cardOrder: this.state.cardOrder.includes(entry.card.id)
            ? this.state.cardOrder
            : [...this.state.cardOrder, entry.card.id],
        });
        this.queueCards([entry.card.id]);
        this.removedCards.delete(entry.card.id);
        break;
      }
      case "add-card": {
        // Undoing a creation removes the card; it must not offer "restore" next.
        this.removeCardSilently(entry.cardId);
        break;
      }
      case "delete-layer": {
        this.set({
          layers: [entry.layer, ...this.state.layers],
          cards: {
            ...this.state.cards,
            ...Object.fromEntries(entry.cards.map((card) => [card.id, card])),
          },
          cardOrder: [
            ...new Set([
              ...this.state.cardOrder,
              ...entry.cards.map((card) => card.id).filter((id) => !this.state.cardOrder.includes(id)),
            ]),
          ],
        });
        this.queueLayers([entry.layer.id]);
        this.queueCards(entry.cards.map((card) => card.id));
        this.removedLayers.delete(entry.layer.id);
        break;
      }
      case "move-card": {
        const card = this.state.cards[entry.cardId];
        if (card) {
          this.set({
            cards: { ...this.state.cards, [card.id]: { ...card, position: entry.from } },
          });
          this.queueCards([card.id]);
        }
        break;
      }
    }
    this.set({ undoDepth: this.undoStack.length });
    this.notify("Undone", { tone: "success" });
  }

  // ------------------------------------------------------------------ ui

  setSelected(id: string | null): void {
    if (this.state.selectedCardId === id) return;
    this.set({ selectedCardId: id });
  }

  setEditing(id: string | null): void {
    if (this.state.editingCardId === id) return;
    this.set({ editingCardId: id, selectedCardId: id ?? this.state.selectedCardId });
  }

  setOverlay(overlay: OverlayName): void {
    if (this.state.overlay === overlay) return;
    this.set({ overlay });
  }

  setLayerDialog(dialog: LayerDialogState): void {
    this.set({ layerDialog: dialog, overlay: dialog ? "layer-dialog" : null });
  }

  requestMedia(kind: "image" | "file", targetLayerId?: string): void {
    const layerId = targetLayerId ?? this.state.openLayerId;
    if (!layerId) {
      this.notify("Open a Layer first, then add files to it.", { tone: "warning" });
      return;
    }
    this.set({
      mediaRequest: {
        id: Date.now(),
        kind,
        accept: kind === "image" ? "image/*" : "*/*",
      },
    });
  }

  clearMediaRequest(): void {
    if (this.state.mediaRequest) this.set({ mediaRequest: null });
  }

  notify(
    text: string,
    options?: { tone?: NoticeTone; actionLabel?: string; action?: () => void; duration?: number },
  ): void {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    const notice: Notice = {
      id: Date.now(),
      tone: options?.tone ?? "info",
      text,
      action: options?.action ? { label: options.actionLabel ?? "Undo", run: options.action } : undefined,
    };
    this.set({ notice });
    this.noticeTimer = setTimeout(() => {
      this.noticeTimer = null;
      if (this.state.notice?.id === notice.id) this.set({ notice: null });
    }, options?.duration ?? 5_000);
  }

  dismissNotice(): void {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.set({ notice: null });
  }

  private clearFocusSoon(): void {
    if (this.focusTimer) clearTimeout(this.focusTimer);
    this.focusTimer = setTimeout(() => {
      this.focusTimer = null;
      if (this.state.focusCardId) this.set({ focusCardId: null });
    }, 1_100);
  }

  /** Queue "show me this card" across a route change. */
  requestReveal(layerId: string, cardId: string): void {
    this.set({ revealTarget: { layerId, cardId } });
  }

  consumeReveal(layerId: string): string | null {
    const target = this.state.revealTarget;
    if (!target || target.layerId !== layerId) return null;
    this.set({ revealTarget: null });
    return target.cardId;
  }

  /** Point the camera at a card and flash it — used by search and the palette. */
  revealCard(id: string): void {
    const card = this.state.cards[id];
    if (!card) return;
    const camera = this.camera;
    if (camera && (this.state.openLayerId === null || this.state.openLayerId === card.layerId)) {
      camera.centerOn(
        {
          x: card.position.x + (card.position.width ?? CARD_DEFAULT_WIDTH) / 2,
          y: card.position.y + 110,
        },
        { animate: true },
      );
      this.setLayerViewport(card.layerId, camera.getViewport());
    }
    this.set({ selectedCardId: id, focusCardId: id });
    this.clearFocusSoon();
  }

  setFocusCard(id: string | null): void {
    this.set({ focusCardId: id });
    if (id) this.clearFocusSoon();
  }

  // -------------------------------------------------------------- settings

  updateSettings(patch: Partial<Settings>): void {
    const settings: Settings = { ...this.state.settings, ...patch, version: 1 };
    this.set({ settings });
    this.settingsDirty = true;
    this.scheduleFlush();
  }

  // ----------------------------------------------------------------- media

  /** Load a stored asset as an object URL, cached for the session. */
  async objectUrl(mediaId: string): Promise<string | null> {
    if (!mediaId) return null;
    const cached = this.objectUrls.get(mediaId);
    if (cached) return cached;
    const repository = this.repository;
    if (!repository) return null;
    const media = await repository.getMedia(mediaId);
    if (!media) return null;
    const bytes = media.data;
    const blob = new Blob([bytes as ArrayBuffer], { type: media.mime || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    this.objectUrls.set(mediaId, url);
    return url;
  }

  /** Persist a picked file and attach it to a card. */
  async attachFile(
    layerId: string,
    kind: "image" | "file",
    file: File,
    position?: Partial<CardPosition>,
  ): Promise<Card | null> {
    const repository = this.repository;
    if (!repository) {
      this.notify("Storage isn't ready yet — try again in a moment.", { tone: "warning" });
      return null;
    }
    const limit = kind === "image" ? 25 * 1024 * 1024 : 32 * 1024 * 1024;
    if (file.size > limit) {
      this.notify(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. LAYER keeps attachments under ${limit / 1024 / 1024} MB.`,
        { tone: "danger", duration: 8_000 },
      );
      return null;
    }
    if (!/^[a-z0-9+.-]+\/[a-z0-9.+-]+$/i.test(file.type || "") && kind === "image") {
      this.notify("That doesn't look like an image file.", { tone: "danger" });
      return null;
    }

    const mediaId = createId("med");
    try {
      const buffer = await file.arrayBuffer();
      await repository.putMedia({ id: mediaId, mime: file.type || "application/octet-stream", data: buffer });
    } catch (error) {
      this.notify(
        error instanceof Error ? error.message : "Could not store that file — local storage may be full.",
        { tone: "danger", duration: 8_000 },
      );
      return null;
    }

    const dimensions = kind === "image" ? await readImageSize(mediaId, this).catch(() => null) : null;
    const card = this.insertCard(layerId, kind, {
      title: sanitizeLine(file.name.replace(/\.[a-z0-9]{1,8}$/i, ""), MAX_TITLE),
      position,
      edit: false,
      data: {
        mediaId,
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        ...(kind === "image"
          ? { width: dimensions?.width ?? 0, height: dimensions?.height ?? 0, alt: "" }
          : { caption: "" }),
      },
    });
    this.notify(kind === "image" ? "Image added" : "File attached", { tone: "success" });
    return card;
  }

  /** Swap the bytes behind an existing image/file card. */
  async replaceFile(cardId: string, file: File): Promise<boolean> {
    const card = this.state.cards[cardId];
    if (!card || (card.kind !== "image" && card.kind !== "file")) return false;
    const repository = this.repository;
    if (!repository) {
      this.notify("Storage isn't ready yet — try again in a moment.", { tone: "warning" });
      return false;
    }
    const limit = card.kind === "image" ? 25 * 1024 * 1024 : 32 * 1024 * 1024;
    if (file.size > limit) {
      this.notify(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. LAYER keeps attachments under ${limit / 1024 / 1024} MB.`,
        { tone: "danger", duration: 8_000 },
      );
      return false;
    }
    const previous = "mediaId" in card.data ? card.data.mediaId : "";
    const mediaId = createId("med");
    try {
      const buffer = await file.arrayBuffer();
      await repository.putMedia({ id: mediaId, mime: file.type || "application/octet-stream", data: buffer });
    } catch (error) {
      this.notify(
        error instanceof Error ? error.message : "Could not store that file — local storage may be full.",
        { tone: "danger", duration: 8_000 },
      );
      return false;
    }
    const dimensions = card.kind === "image" ? await readImageSize(mediaId, this).catch(() => null) : null;
    this.updateCard(cardId, {
      data: {
        mediaId,
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        ...(card.kind === "image"
          ? { width: dimensions?.width ?? 0, height: dimensions?.height ?? 0 }
          : {}),
      } as Partial<Card["data"]>,
    });
    if (previous && previous !== mediaId) {
      this.removedMedia.add(previous);
      const url = this.objectUrls.get(previous);
      if (url) {
        URL.revokeObjectURL(url);
        this.objectUrls.delete(previous);
      }
      await this.flush();
    }
    this.notify("Attachment replaced", { tone: "success" });
    return true;
  }

  async detachMedia(cardId: string): Promise<void> {
    const card = this.state.cards[cardId];
    if (!card || !("mediaId" in card.data)) return;
    const mediaId = card.data.mediaId;
    this.updateCard(cardId, { data: { mediaId: "" } as Partial<Card["data"]> });
    if (mediaId) {
      this.removedMedia.add(mediaId);
      const url = this.objectUrls.get(mediaId);
      if (url) {
        URL.revokeObjectURL(url);
        this.objectUrls.delete(mediaId);
      }
      await this.flush();
    }
  }

  // -------------------------------------------------------- data lifecycle

  /** Public handle for the data module (export / import / reset). */
  getRepository(): RepositoryHandle | null {
    return this.repository;
  }

  patchState(patch: Partial<AppState>): void {
    this.set(patch);
  }

  clearObjectUrls(): void {
    for (const url of this.objectUrls.values()) URL.revokeObjectURL(url);
    this.objectUrls.clear();
  }

  resetWriteBuffers(): void {
    this.dirtyCards.clear();
    this.dirtyLayers.clear();
    this.removedCards.clear();
    this.removedLayers.clear();
    this.removedMedia.clear();
    this.undoStack = [];
  }

  forgetUndo(): void {
    this.undoStack = [];
  }

  /** Used after import: rebuild memory straight from the durable store. */
  async applySnapshot(snapshot: {
    layers: Layer[];
    cards: Card[];
    settings: Settings;
  }): Promise<void> {
    const cards: Record<string, Card> = {};
    for (const card of snapshot.cards) cards[card.id] = card;
    this.set({
      layers: snapshot.layers,
      cards,
      cardOrder: snapshot.cards.map((card) => card.id),
      settings: snapshot.settings,
    });
  }

  // ------------------------------------------------------------------ demo

  /**
   * "Try an example": a real Layer built from real cards, tagged as demo
   * content so the UI can label it honestly and delete it in one action.
   */
  async seedDemoLayer(): Promise<Layer | null> {
    if (this.hasDemoLayer()) {
      const existing = this.state.layers.find((layer) => layer.metadata?.demo === true);
      if (existing) {
        this.openLayer(existing.id);
        return existing;
      }
    }
    const layer = await this.createLayer({
      ...DEMO_LAYER,
      metadata: { demo: true, source: "demo" },
    });
    for (const [index, item] of DEMO_CARDS.entries()) {
      this.insertCard(layer.id, item.kind, {
        seed: `${layer.id}:demo:${index}`,
        title: item.title,
        position: { x: item.x, y: item.y, width: item.width },
        data: item.data,
        demo: true,
        edit: false,
      });
    }
    await this.flush();
    this.frameLayer(layer.id);
    await this.flush();
    this.notify("Example Layer created. It is real and editable — delete it any time.", {
      tone: "success",
      duration: 7_000,
    });
    return this.layerById(layer.id) ?? layer;
  }

  /** Zoom the camera so every card in a Layer is visible at once. */
  frameLayer(layerId: string): void {
    const camera = this.camera;
    if (!camera) return;
    const cards = this.cardsOf(layerId);
    if (cards.length === 0) {
      camera.setViewport({ x: 0, y: 0, scale: 1 }, { animate: true });
      this.setLayerViewport(layerId, camera.getViewport());
      return;
    }
    camera.fitTo(cards.map(cardRect), { padding: 120 });
    this.setLayerViewport(layerId, camera.getViewport());
  }

  /** "Try an example" should never stack up demo Layers. */
  hasDemoLayer(): boolean {
    return this.state.layers.some((layer) => layer.metadata?.demo === true);
  }

  /** True when nothing has been created yet: drives the first-run screen. */
  isEmpty(): boolean {
    return this.state.layers.length === 0;
  }
}

/** Natural size of an attached image, for the card's aspect ratio. */
async function readImageSize(mediaId: string, store: LayerStore): Promise<{ width: number; height: number }> {
  const url = await store.objectUrl(mediaId);
  if (!url) return { width: 0, height: 0 };
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = url;
  });
}

let singleton: LayerStore | null = null;

/** Single store per tab: IndexedDB + React both want exactly one owner. */
export function getLayerStore(): LayerStore {
  if (!singleton) singleton = new LayerStore();
  return singleton;
}
