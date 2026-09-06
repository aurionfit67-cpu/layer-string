"use client";

import { useEffect } from "react";

import { isCoarsePointer } from "@/hooks/use-media-query";
import { useStore } from "@/lib/state/provider";
import { resolveViewMode } from "@/lib/state/selectors";
import { snapToGrid } from "@/lib/types";

const NAV_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

/**
 * Global keyboard bindings, deliberately narrow.
 *
 * - every single-key binding is inert while a field has focus, so typing is
 *   never stolen;
 * - workspace keys (+, 0, 1, t, v, n, d) avoid the reserved browser combos
 *   (Cmd+N, Cmd+D) that a web app cannot reliably take over;
 * - Escape belongs to whichever native <dialog> is open, so it can never close
 *   two layers at once.
 *
 * The list displayed in Settings and in the "?" dialog is generated from
 * lib/utils/shortcuts.ts; this is the only other place bindings exist.
 */
export function Hotkeys(): null {
  const store = useStore();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = store.getState();
      const target = event.target as HTMLElement | null;
      const typing =
        target !== null &&
        (target.isContentEditable === true ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key;
      const lower = key.toLowerCase();
      const camera = store.getCamera();
      const layerId = state.openLayerId;

      if (mod && !event.shiftKey && lower === "k") {
        event.preventDefault();
        store.setOverlay(state.overlay === "palette" ? null : "palette");
        return;
      }
      if (mod && event.shiftKey && lower === "f") {
        event.preventDefault();
        store.setOverlay(state.overlay === "search" ? null : "search");
        return;
      }
      if (mod && lower === "z" && !typing) {
        event.preventDefault();
        store.undo();
        return;
      }
      if (mod) return;

      if (key === "Escape") {
        if (state.layerDialog) {
          store.setLayerDialog(null);
          return;
        }
        if (state.overlay) return; // the open dialog owns this event
        if (state.editingCardId) {
          (document.activeElement as HTMLElement | null)?.blur?.();
          store.setEditing(null);
          return;
        }
        if (state.selectedCardId) store.setSelected(null);
        return;
      }

      if (typing) return;

      if (key === "?") {
        event.preventDefault();
        store.setOverlay(state.overlay === "shortcuts" ? null : "shortcuts");
        return;
      }

      if (lower === "n" && !layerId) {
        event.preventDefault();
        store.setLayerDialog({ mode: "create" });
        return;
      }
      if (!layerId) return;

      switch (lower) {
        case "+":
        case "=":
          event.preventDefault();
          camera?.zoomStep(1);
          return;
        case "-":
        case "_":
          event.preventDefault();
          camera?.zoomStep(-1);
          return;
        case "0":
          event.preventDefault();
          camera?.resetZoom();
          return;
        case "1":
          event.preventDefault();
          store.frameLayer(layerId);
          return;
        case "t":
          event.preventDefault();
          store.updateSettings({ snapToGrid: !state.settings.snapToGrid });
          return;
        case "v": {
          event.preventDefault();
          const mode = resolveViewMode(store.layerById(layerId), isCoarsePointer());
          store.setViewMode(layerId, mode === "canvas" ? "list" : "canvas");
          return;
        }
        case "n":
          event.preventDefault();
          store.addCard(layerId, "note");
          return;
        case "d":
          if (!state.selectedCardId) return;
          event.preventDefault();
          store.duplicateCard(state.selectedCardId);
          return;
        default:
          break;
      }

      if (key === "Delete" || (key === "Backspace" && event.shiftKey)) {
        if (!state.selectedCardId || state.editingCardId) return;
        event.preventDefault();
        store.deleteCard(state.selectedCardId);
        return;
      }

      if (!NAV_KEYS.has(key) || !state.selectedCardId || state.editingCardId) return;
      const card = state.cards[state.selectedCardId];
      if (!card) return;
      event.preventDefault();
      const step = event.shiftKey ? 1 : (state.settings.gridSize || 24);
      const dx = key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0;
      const dy = key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0;
      const freehand = event.shiftKey || !state.settings.snapToGrid;
      store.moveCard(card.id, {
        ...card.position,
        x: freehand ? card.position.x + dx : snapToGrid(card.position.x + dx, step),
        y: freehand ? card.position.y + dy : snapToGrid(card.position.y + dy, step),
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store]);

  return null;
}
