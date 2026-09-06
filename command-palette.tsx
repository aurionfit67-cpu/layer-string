"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { Combo } from "@/components/ui/combo";
import { Modal } from "@/components/ui/modal";
import { useRoster } from "@/hooks/use-roster";
import { exportWorkspace } from "@/lib/state/data";
import { useAppState, useStore } from "@/lib/state/provider";
import { searchWorkspace } from "@/lib/state/selectors";
import type { LayerStore } from "@/lib/state/store";
import type { CardKind, Layer } from "@/lib/types";
import { CardIcon, LayerIcon } from "@/lib/workspace/icons";
import { cn } from "@/lib/utils/cn";
import { subsequenceScore } from "@/lib/utils/fuzzy";

type Command = {
  id: string;
  group: string;
  label: string;
  detail?: string;
  icon?: ReactNode;
  keys?: string[];
  run: () => void;
};

type Row = Command & { score: number };

/**
 * The palette is LAYER's second core interaction after the canvas: anything
 * reachable by mouse is reachable from here. Typing searches Layers and cards;
 * typing `>` narrows to commands — the convention people already carry from
 * other tools, so there is nothing new to learn.
 */
export function CommandPalette() {
  const store = useStore();
  const router = useRouter();
  const open = useAppState((state) => state.overlay === "palette");
  const layers = useAppState((state) => state.layers);
  const cards = useAppState((state) => state.cards);
  const order = useAppState((state) => state.cardOrder);
  const openLayerId = useAppState((state) => state.openLayerId);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const commandsOnly = query.trimStart().startsWith(">");
  const text = (commandsOnly ? query.trimStart().slice(1) : query).trim();

  const go = useCallback(
    (href: string) => {
      store.setOverlay(null);
      if (!href.startsWith("/layers/")) store.closeLayer();
      router.push(href);
    },
    [router, store],
  );

  const goToLayer = useCallback(
    (layerId: string, cardId?: string) => {
      if (cardId) store.requestReveal(layerId, cardId);
      else store.openLayer(layerId);
      store.setOverlay(null);
      router.push(`/layers/${layerId}`);
    },
    [router, store],
  );

  const commands = useMemo(
    () => buildCommands({ store, layers, openLayerId, goToLayer, go }),
    [store, layers, openLayerId, goToLayer, go],
  );

  const rows = useMemo<Row[]>(() => {
    if (commandsOnly) {
      return commands
        .map((command) => ({ ...command, score: subsequenceScore(text, `${command.group} ${command.label} ${command.detail ?? ""}`) }))
        .filter((command) => command.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
    }
    if (text.length === 0) {
      return commands.filter((command) => command.group !== "Open").slice(0, 12).map((command) => ({ ...command, score: 0 }));
    }
    const hits = searchWorkspace(text, layers, cards, order, { limit: 12 }).map((hit): Row => {
      const layer = layers.find((candidate) => candidate.id === hit.layerId);
      return {
        id: hit.key,
        group: hit.type === "layer" ? "Layers" : "Cards",
        label: hit.title,
        detail: hit.type === "card" ? `${hit.layerName} · ${hit.preview}` : hit.subtitle,
        icon:
          hit.type === "layer" ? (
            <LayerIcon icon={layer?.icon} size={14} />
          ) : (
            <CardIcon kind={hit.cardKind} size={14} />
          ),
        run: () => (hit.type === "layer" ? goToLayer(hit.layerId) : goToLayer(hit.layerId, hit.cardId)),
        score: hit.score,
      };
    });
    const nearMisses = commands
      .map((command) => ({ ...command, score: subsequenceScore(text, command.label) * 0.9 }))
      .filter((command) => command.score > 40)
      .sort((a, b) => b.score - a.score);
    return [...hits, ...nearMisses].slice(0, 24);
  }, [cards, commandsOnly, commands, layers, order, text, goToLayer]);

  const { index, setIndex, move } = useRoster(rows.length, listRef);
  const close = useCallback(() => {
    store.setOverlay(null);
    setQuery("");
  }, [store]);

  const grouped = useMemo(() => {
    const out: Array<{ group: string; items: Row[] }> = [];
    for (const row of rows) {
      const bucket = out.find((entry) => entry.group === row.group);
      if (bucket) bucket.items.push(row);
      else out.push({ group: row.group, items: [row] });
    }
    return out;
  }, [rows]);

  if (!open) return null;

  return (
    <Modal open={open} onClose={close} align="top" className="w-[min(94vw,620px)]">
      <div className="flex items-center gap-2.5 border-b border-line/70 px-3.5 py-3">
        <span className="text-faint" aria-hidden>
          <SearchGlyph />
        </span>
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              move(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              move(-1);
            } else if (event.key === "Tab") {
              event.preventDefault();
              move(event.shiftKey ? -1 : 1);
            } else if (event.key === "Enter") {
              event.preventDefault();
              const row = rows[index];
              if (row) {
                close();
                row.run();
              }
            }
          }}
          placeholder="Search Layers and cards, or type > for commands"
          aria-label="Command palette"
          role="combobox"
          aria-expanded="true"
          aria-controls="layer-palette-list"
          aria-autocomplete="list"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-faint"
        />
        <button
          type="button"
          onClick={close}
          className="rounded-md px-1.5 py-0.5 font-mono text-[11px] text-faint transition-colors hover:bg-surface-3 hover:text-ink"
        >
          esc
        </button>
      </div>

      <div
        ref={listRef}
        id="layer-palette-list"
        role="listbox"
        aria-label="Palette results"
        data-scroll
        className="max-h-[min(58vh,470px)] min-h-[140px] overflow-y-auto p-1.5"
      >
        {rows.length === 0 ? (
          <div className="grid gap-1.5 px-4 py-10 text-center">
            <p className="text-[13px] text-muted">
              {text ? (
                <>
                  Nothing matches <span className="font-medium text-ink">“{text}”</span>
                </>
              ) : (
                "Start typing to search your workspace."
              )}
            </p>
            {!commandsOnly && text ? (
              <p className="text-[11.5px] text-faint">
                Search covers Layer names, card titles, note text, URLs and file names.
              </p>
            ) : null}
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.group} className="mb-1 last:mb-0">
              <p className="eyebrow px-2.5 pb-1 pt-2">{group.group}</p>
              {group.items.map((row) => {
                const at = rows.indexOf(row);
                const active = at === index;
                return (
                  <button
                    key={`${row.group}-${row.id}`}
                    type="button"
                    role="option"
                    id={`palette-option-${at}`}
                    data-roster={at}
                    aria-selected={active}
                    onMouseMove={() => setIndex(at)}
                    onClick={() => {
                      close();
                      row.run();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition-colors",
                      active ? "bg-surface-3 text-ink" : "text-muted",
                    )}
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center text-faint [&>svg]:h-3.5 [&>svg]:w-3.5">
                      {row.icon ?? <Dot />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{row.label}</span>
                      {row.detail ? <span className="block truncate text-[11.5px] text-faint">{row.detail}</span> : null}
                    </span>
                    {row.keys ? <Combo keys={row.keys} /> : null}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line/70 bg-surface-2 px-3.5 py-2 text-[11px] text-faint">
        <span className="flex items-center gap-2.5">
          <span className="flex items-center gap-1">
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd>
            move
          </span>
          <span className="flex items-center gap-1">
            <kbd className="kbd">↵</kbd>
            run
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            <kbd className="kbd">&gt;</kbd>
            commands only
          </span>
        </span>
        <span className="hidden sm:inline">
          {layers.length} {layers.length === 1 ? "Layer" : "Layers"} · {order.length} {order.length === 1 ? "card" : "cards"}
        </span>
      </div>
    </Modal>
  );
}

function buildCommands({
  store,
  layers,
  openLayerId,
  goToLayer,
  go,
}: {
  store: LayerStore;
  layers: Layer[];
  openLayerId: string | null;
  goToLayer: (layerId: string, cardId?: string) => void;
  go: (href: string) => void;
}): Command[] {
  const state = store.getState();
  const undoLabel = state.undoDepth > 0 ? store.undoLabel() : null;
  const targetLayer = openLayerId ?? layers[0]?.id ?? null;

  const add = (kind: CardKind) => () => {
    if (kind === "image" || kind === "file") {
      store.requestMedia(kind, targetLayer ?? undefined);
      if (!targetLayer) store.notify("Open a Layer first, then add files to it.", { tone: "warning" });
      return;
    }
    if (!targetLayer) {
      store.setLayerDialog({ mode: "create" });
      return;
    }
    const card = store.addCard(targetLayer, kind);
    if (targetLayer !== openLayerId) goToLayer(targetLayer, card.id);
  };

  const commands: Command[] = [
    {
      id: "new-layer",
      group: "Create",
      label: "New Layer",
      keys: ["Mod", "N"],
      icon: <PlusGlyph />,
      run: () => store.setLayerDialog({ mode: "create" }),
    },
    {
      id: "add-note",
      group: "Create",
      label: "Add Note",
      detail: targetLayer ? (openLayerId ? "Into this Layer" : `Into “${layers[0]?.name ?? "your Layer"}”`) : "Needs a Layer first",
      icon: <KindGlyph kind="note" />,
      run: add("note"),
    },
    { id: "add-task", group: "Create", label: "Add Task", icon: <KindGlyph kind="task" />, run: add("task") },
    { id: "add-link", group: "Create", label: "Add Link", icon: <KindGlyph kind="link" />, run: add("link") },
    {
      id: "add-image",
      group: "Create",
      label: "Add Image",
      detail: "Stored on this device only",
      icon: <KindGlyph kind="image" />,
      run: add("image"),
    },
    {
      id: "add-file",
      group: "Create",
      label: "Add File",
      detail: "Stored on this device only",
      icon: <KindGlyph kind="file" />,
      run: add("file"),
    },
    {
      id: "search",
      group: "Go",
      label: "Search everything",
      keys: ["Mod", "Shift", "F"],
      run: () => store.setOverlay("search"),
    },
    { id: "home", group: "Go", label: "Go Home", run: () => go("/") },
    { id: "layers", group: "Go", label: "All Layers", run: () => go("/layers") },
    { id: "settings", group: "Go", label: "Settings", run: () => go("/settings") },
    {
      id: "recent",
      group: "Go",
      label: "Reopen last Layer",
      detail: layers[0]?.name,
      run: () => (layers[0] ? goToLayer(layers[0].id) : store.notify("No Layers yet.", { tone: "warning" })),
    },
    { id: "shortcuts", group: "View", label: "Keyboard shortcuts", keys: ["?"], run: () => store.setOverlay("shortcuts") },
    {
      id: "theme",
      group: "View",
      label: "Cycle theme",
      detail: `Currently ${state.settings.theme}`,
      run: () => {
        const next =
          state.settings.theme === "dark" ? "light" : state.settings.theme === "light" ? "system" : "dark";
        store.updateSettings({ theme: next });
      },
    },
    {
      id: "snap",
      group: "View",
      label: state.settings.snapToGrid ? "Snap to grid: on" : "Snap to grid: off",
      detail: "Aligns cards while you drag",
      run: () => store.updateSettings({ snapToGrid: !state.settings.snapToGrid }),
    },
    {
      id: "view",
      group: "View",
      label: openLayerId ? "Toggle canvas / list view" : "Toggle canvas / list view",
      run: () => {
        if (!openLayerId) return;
        const mode = store.layerById(openLayerId)?.viewport?.mode ?? "canvas";
        store.setViewMode(openLayerId, mode === "canvas" ? "list" : "canvas");
      },
    },
    { id: "fit", group: "View", label: "Fit Layer to screen", run: () => (openLayerId ? store.frameLayer(openLayerId) : undefined) },
    {
      id: "undo",
      group: "Edit",
      label: undoLabel ? `Undo · ${undoLabel}` : "Undo",
      detail: undoLabel ? "Keys, moves and deletions" : "Nothing to undo yet",
      run: () => store.undo(),
    },
    { id: "export", group: "Data", label: "Export data (JSON backup)", run: () => void exportWorkspace(store, true) },
    { id: "import", group: "Data", label: "Import a backup", detail: "Settings → Data", run: () => go("/settings") },
  ];

  for (const layer of layers.slice(0, 8)) {
    commands.push({
      id: `open-${layer.id}`,
      group: "Open",
      label: layer.name,
      detail: layer.description ? undefined : "Layer",
      icon: <LayerIcon icon={layer.icon} size={14} />,
      run: () => goToLayer(layer.id),
    });
  }

  return commands;
}

function KindGlyph({ kind }: { kind: CardKind }) {
  return <CardIcon kind={kind} size={14} />;
}

function PlusGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
    </svg>
  );
}

function Dot() {
  return <span className="block h-1 w-1 rounded-full bg-current" aria-hidden />;
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" strokeLinecap="round" />
    </svg>
  );
}
