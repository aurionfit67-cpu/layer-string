"use client";

/**
 * Strings — manual, user-drawn connections between cards on the canvas.
 *
 * This is a single, self-contained addition. It does not touch the Zustand
 * store, the IndexedDB schema, or any other file's exports — it keeps its own
 * tiny list of connections in localStorage, one array per Layer, and reads
 * card positions straight off the DOM (the same `translate3d(x, y, 0)` values
 * CardShell already writes) so strings track drags, resizes, panning and
 * zooming without any cooperation from the rest of the app.
 *
 * How to use it (no on-screen UI, by design — see the note at the bottom of
 * this file for why):
 *   - Hold Shift and click a card to start a string from it (it gets a dashed
 *     outline while a string is pending).
 *   - Hold Shift and click a different card to finish the string. You'll be
 *     asked for an optional label.
 *   - Shift+click the same pending card again, or press Escape, to cancel.
 *   - Click directly on a string's line to remove it (with confirmation).
 *   - Click a string's label chip to rename it.
 *
 * Mount this once, as a sibling of <CardLayer> inside <WorkspaceCanvas>, e.g.
 * in workspace.tsx:
 *
 *   import { CardStrings } from "./card-strings";
 *   ...
 *   <WorkspaceCanvas layerId={layer.id} overlay={...}>
 *     <CardLayer layerId={layer.id} mode="canvas" />
 *     <CardStrings layerId={layer.id} />
 *   </WorkspaceCanvas>
 *
 * That one addition is the only edit this feature needs in an existing file.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppState, useStore } from "@/lib/state/provider";

type StringLink = {
  id: string;
  from: string;
  to: string;
  label: string;
  createdAt: number;
};

type LiveRect = { cx: number; cy: number };

const STORAGE_PREFIX = "layer:strings:";
const PALETTE = ["#e0575b", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length] ?? "#3b82f6";
}

function loadLinks(layerId: string): StringLink[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + layerId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLinks(layerId: string, links: StringLink[]): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + layerId, JSON.stringify(links));
  } catch {
    // Storage disabled or full — strings just won't persist this session.
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `str_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Live center of a card, read straight from its DOM node's own transform and size. */
function liveRect(cardId: string): LiveRect | null {
  const node = document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(cardId)}"]`);
  if (!node) return null;
  const match = /translate3d\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(node.style.transform);
  const x = match ? parseFloat(match[1] ?? "0") : 0;
  const y = match ? parseFloat(match[2] ?? "0") : 0;
  return { cx: x + node.offsetWidth / 2, cy: y + node.offsetHeight / 2 };
}

function curvePath(a: LiveRect, b: LiveRect): { d: string; mx: number; my: number } {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const bow = Math.min(56, dist * 0.14);
  const midX = (a.cx + b.cx) / 2 + nx * bow;
  const midY = (a.cy + b.cy) / 2 + ny * bow;
  return {
    d: `M ${a.cx} ${a.cy} Q ${midX} ${midY} ${b.cx} ${b.cy}`,
    // Point on the quadratic curve at t=0.5, for the label.
    mx: 0.25 * a.cx + 0.5 * midX + 0.25 * b.cx,
    my: 0.25 * a.cy + 0.5 * midY + 0.25 * b.cy,
  };
}

export function CardStrings({ layerId }: { layerId: string }) {
  const store = useStore();
  const cardOrder = useAppState((state) => state.cardOrder);
  const [links, setLinks] = useState<StringLink[]>(() => loadLinks(layerId));
  const [pending, setPending] = useState<string | null>(null);
  // Tracks which Layer `links` currently holds, so a layerId change can be
  // caught and re-loaded during render (React's documented pattern for
  // resetting state from a prop change) instead of via a setState-in-effect,
  // which both React and this project's lint rules steer away from.
  const [loadedFor, setLoadedFor] = useState(layerId);
  if (layerId !== loadedFor) {
    setLoadedFor(layerId);
    setLinks(loadLinks(layerId));
    setPending(null);
  }
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const hitRefs = useRef(new Map<string, SVGPathElement>());
  const labelRefs = useRef(new Map<string, SVGGElement>());

  // A card can be deleted elsewhere in the app. Rather than pruning `links`
  // itself from inside an effect, the valid subset is derived at render time;
  // an effect below only writes the trimmed list out to storage (an external
  // system), which is exactly the update effects are for.
  const validLinks = useMemo(() => {
    const state = store.getState();
    return links.filter((link) => state.cards[link.from] && state.cards[link.to]);
    // `cardOrder` isn't read directly, but it's the signal that a card was
    // added or removed, which is exactly when `store.getState().cards` needs
    // re-checking (the store itself is a stable reference).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, cardOrder, store]);

  useEffect(() => {
    saveLinks(layerId, validLinks);
  }, [validLinks, layerId]);

  const clearPending = useCallback(() => {
    if (pending) document.querySelector(`[data-card-id="${CSS.escape(pending)}"]`)?.removeAttribute("data-string-pending");
    setPending(null);
  }, [pending]);

  // Shift+click two cards in turn to connect them.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!event.shiftKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("[data-no-drag]")) return; // don't hijack titles, menus, inputs
      const cardEl = target.closest<HTMLElement>("[data-card-id]");
      if (!cardEl) return;
      const id = cardEl.getAttribute("data-card-id");
      if (!id) return;

      if (!pending) {
        cardEl.setAttribute("data-string-pending", "true");
        setPending(id);
        return;
      }
      if (pending === id) {
        clearPending();
        return;
      }
      clearPending();
      const label = window.prompt("Label this string (optional):", "") ?? null;
      if (label === null) return; // cancelled
      setLinks((current) => [
        ...current,
        { id: newId(), from: pending, to: id, label: label.trim(), createdAt: Date.now() },
      ]);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") clearPending();
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pending, clearPending, layerId]);

  const removeLink = useCallback((id: string) => {
    setLinks((current) => current.filter((link) => link.id !== id));
  }, []);

  const renameLink = useCallback((id: string) => {
    setLinks((current) => {
      const target = current.find((link) => link.id === id);
      if (!target) return current;
      const label = window.prompt("Rename this string:", target.label);
      if (label === null) return current;
      return current.map((link) => (link.id === id ? { ...link, label: label.trim() } : link));
    });
  }, []);

  // High-frequency position updates are written straight to the SVG elements,
  // the same way the workspace camera writes transforms directly instead of
  // going through React — so dragging a card doesn't fight this feature.
  useEffect(() => {
    if (validLinks.length === 0) return;
    let frame: number;
    const tick = () => {
      for (const link of validLinks) {
        const a = liveRect(link.from);
        const b = liveRect(link.to);
        if (a && b) {
          const { d, mx, my } = curvePath(a, b);
          pathRefs.current.get(link.id)?.setAttribute("d", d);
          hitRefs.current.get(link.id)?.setAttribute("d", d);
          const label = labelRefs.current.get(link.id);
          if (label) label.setAttribute("transform", `translate(${mx}, ${my})`);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [validLinks]);

  const withColors = useMemo(
    () => validLinks.map((link) => ({ ...link, color: colorFor(link.id) })),
    [validLinks],
  );

  return (
    <div className="absolute left-0 top-0 h-0 w-0" aria-hidden>
      <style>{`
        [data-string-pending="true"] { outline: 2px dashed var(--accent, #3b82f6); outline-offset: 3px; }
      `}</style>
      <svg className="absolute left-0 top-0 overflow-visible" style={{ width: 0, height: 0 }}>
        {withColors.map((link) => (
          <g key={link.id}>
            <path
              ref={(node) => {
                if (node) hitRefs.current.set(link.id, node);
                else hitRefs.current.delete(link.id);
              }}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onClick={(event) => {
                event.stopPropagation();
                if (window.confirm(link.label ? `Remove the "${link.label}" string?` : "Remove this string?")) {
                  removeLink(link.id);
                }
              }}
            >
              <title>{link.label || "String — click to remove"}</title>
            </path>
            <path
              ref={(node) => {
                if (node) pathRefs.current.set(link.id, node);
                else pathRefs.current.delete(link.id);
              }}
              fill="none"
              stroke={link.color}
              strokeWidth={2}
              strokeDasharray="1 5"
              strokeLinecap="round"
              style={{ pointerEvents: "none" }}
            />
            {link.label ? (
              <g
                ref={(node) => {
                  if (node) labelRefs.current.set(link.id, node);
                  else labelRefs.current.delete(link.id);
                }}
                style={{ pointerEvents: "auto", cursor: "pointer" }}
                onClick={(event) => {
                  event.stopPropagation();
                  renameLink(link.id);
                }}
              >
                <rect
                  x={-(link.label.length * 3.6 + 8)}
                  y={-10}
                  width={link.label.length * 7.2 + 16}
                  height={20}
                  rx={10}
                  fill="var(--surface-2, #fff)"
                  stroke={link.color}
                  strokeWidth={1}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill={link.color}
                >
                  {link.label}
                </text>
              </g>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * Why there's no on-screen button or toolbar for this: adding one cleanly
 * needs a fixed-size control that stays put while the canvas pans and zooms,
 * which means rendering it in <WorkspaceCanvas>'s `overlay` slot rather than
 * beside <CardLayer>. That's a second edit to workspace.tsx instead of one.
 * Shift+click was chosen instead so the entire feature is: add this file, add
 * one line. If you'd rather have a visible toggle/legend, it's a small
 * follow-up — just say so.
 */
