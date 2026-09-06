"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { useCoarsePointer } from "@/hooks/use-media-query";
import { useAppState, useStore } from "@/lib/state/provider";
import { Camera } from "@/lib/workspace/camera";
import { cardRect, type MeasuredRect } from "@/lib/workspace/geometry";
import {
  CARD_DEFAULT_WIDTH,
  MAX_ZOOM,
  MIN_ZOOM,
  clamp,
  snapToGrid,
  type CardPosition,
  type Rect,
} from "@/lib/types";
import { cn } from "@/lib/utils/cn";

export type WorkspaceApi = {
  camera: Camera;
  registerNode: (id: string, node: HTMLElement | null) => void;
  reportHeight: (id: string, height: number) => void;
  rectOf: (id: string) => MeasuredRect | null;
  beginDrag: (event: ReactPointerEvent, id: string) => void;
  beginResize: (event: ReactPointerEvent, id: string) => void;
  precise: boolean;
};

const WorkspaceContext = createContext<WorkspaceApi | null>(null);

export function useWorkspace(): WorkspaceApi {
  const api = useContext(WorkspaceContext);
  if (!api) throw new Error("useWorkspace must be used inside <WorkspaceCanvas>");
  return api;
}

/**
 * Same context, without the throw. List view renders the very same card
 * components outside any canvas, where there is no camera to talk to; those
 * cards fall back to IDLE_WORKSPACE and simply do not drag.
 */
export function useOptionalWorkspace(): WorkspaceApi | null {
  return useContext(WorkspaceContext);
}

/** Stand-ins for the canvas API. Every method is a no-op by design. */
export const IDLE_WORKSPACE = {
  registerNode: () => {},
  reportHeight: () => {},
  rectOf: () => null,
  beginDrag: () => {},
  beginResize: () => {},
  precise: true,
} satisfies Omit<WorkspaceApi, "camera">;

const DRAG_THRESHOLD = 3;
const MIN_CARD_WIDTH = 200;
const MAX_CARD_WIDTH = 760;

type Gesture =
  | { kind: "pan"; pointerId: number; lastX: number; lastY: number }
  | { kind: "pinch"; distance: number; scale: number; midX: number; midY: number }
  | {
      kind: "drag";
      id: string;
      pointerId: number;
      startX: number;
      startY: number;
      origin: CardPosition;
      moved: boolean;
      x?: number;
      y?: number;
    }
  | {
      kind: "resize";
      id: string;
      pointerId: number;
      startX: number;
      originWidth: number;
      moved: boolean;
      width?: number;
    };

type Props = {
  layerId: string;
  /** Card nodes, placed inside the transformed world. */
  children: ReactNode;
  /** Floating chrome, rendered outside the world so it never scales. */
  overlay?: ReactNode;
};

/**
 * The spatial surface: owns the camera, every pointer gesture, and the
 * imperative writes that keep interaction off React's critical path.
 *
 * The rule for this whole file — and for card dragging — is: during a gesture
 * mutate the DOM, on release commit to the store (which persists, debounced).
 * That is why dragging a card never touches IndexedDB until you let go, and why
 * the card cannot jump when React catches up.
 */
export function WorkspaceCanvas({ layerId, children, overlay }: Props) {
  const store = useStore();
  const gridSize = useAppState((state) => state.settings.gridSize);
  const snapEnabled = useAppState((state) => state.settings.snapToGrid);
  const savedViewport = useAppState(
    (state) => state.layers.find((layer) => layer.id === layerId)?.viewport ?? null,
  );

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const heights = useRef(new Map<string, number>());
  const [camera] = useState(() => new Camera(savedViewport ?? undefined));
  const gesture = useRef<Gesture | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const [busy, setBusy] = useState<"idle" | "pan" | "pinch" | "drag" | "resize">("idle");
  const [dropping, setDropping] = useState(false);
  const precise = !useCoarsePointer();

  useEffect(() => {
    camera.bind(worldRef.current, canvasRef.current);
    camera.setGrid(gridSize);
  }, [camera, gridSize]);

  useEffect(() => {
    store.attachCamera(camera);
    return () => store.attachCamera(null);
  }, [camera, store]);

  /** Bring the saved viewport back when this Layer mounts or is reopened. */
  useEffect(() => {
    if (!savedViewport) return;
    camera.setViewport(savedViewport);
    // Deliberately not keyed on savedViewport: this component writes it while the
    // user pans, so depending on it would snap the camera back on every settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, layerId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => camera.setBounds(canvas.clientWidth, canvas.clientHeight);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [camera]);

  /** Persist the camera when the user stops moving it, never per frame. */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = camera.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        store.setLayerViewport(layerId, camera.getViewport());
      }, 320);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [camera, layerId, store]);

  // ------------------------------------------------------------------- wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      // Scrollable content inside a card keeps its own scrolling.
      if (target?.closest("[data-scroll-y]")) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      if (event.ctrlKey || event.metaKey) {
        camera.zoomTo(clamp(camera.getViewport().scale * Math.exp(-event.deltaY * 0.0022), MIN_ZOOM, MAX_ZOOM), point);
        camera.settle();
        return;
      }
      camera.panBy(-(event.shiftKey ? event.deltaY : event.deltaX), -(event.shiftKey ? 0 : event.deltaY));
      camera.settle();
    };
    // React attaches wheel listeners passively; panning must call preventDefault.
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [camera]);

  // --------------------------------------------------------------- gestures
  const endGesture = useCallback(() => {
    gesture.current = null;
    setBusy("idle");
    document.body.style.cursor = "";
    camera.settle();
  }, [camera]);

  const beginPinch = useCallback(() => {
    const [a, b] = [...touches.current.values()] as [
      { x: number; y: number },
      { x: number; y: number },
    ];
    if (!a || !b) return;
    gesture.current = {
      kind: "pinch",
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
      scale: camera.getViewport().scale,
    };
    setBusy("pinch");
  }, [camera]);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const state = gesture.current;
      if (!state) return;

      if (state.kind === "pinch") {
        if (!touches.current.has(event.pointerId)) return;
        touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const [a, b] = [...touches.current.values()] as [
          { x: number; y: number },
          { x: number; y: number },
        ];
        if (!a || !b) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        if (state.distance > 4) {
          camera.zoomTo(clamp((state.scale * distance) / state.distance, MIN_ZOOM, MAX_ZOOM), {
            x: midX - rect.left,
            y: midY - rect.top,
          });
          camera.panBy(midX - state.midX, midY - state.midY);
        }
        state.distance = distance;
        state.midX = midX;
        state.midY = midY;
        return;
      }

      if ("pointerId" in state && event.pointerId !== state.pointerId) return;

      if (state.kind === "pan") {
        camera.panBy(event.clientX - state.lastX, event.clientY - state.lastY);
        if (touches.current.size > 0) touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        state.lastX = event.clientX;
        state.lastY = event.clientY;
        camera.settle();
        return;
      }

      if (state.kind === "drag") {
        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        if (!state.moved) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          state.moved = true;
          setBusy("drag");
          nodes.current.get(state.id)?.setAttribute("data-dragging", "true");
        }
        const scale = camera.getViewport().scale;
        let x = state.origin.x + dx / scale;
        let y = state.origin.y + dy / scale;
        // Alt is the escape hatch: one careful placement without the grid.
        if (snapEnabled && !event.altKey) {
          x = snapToGrid(x, gridSize);
          y = snapToGrid(y, gridSize);
        }
        state.x = x;
        state.y = y;
        const node = nodes.current.get(state.id);
        if (node) node.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
        return;
      }

      if (state.kind === "resize") {
        const scale = camera.getViewport().scale;
        const width = clamp(state.originWidth + (event.clientX - state.startX) / scale, MIN_CARD_WIDTH, MAX_CARD_WIDTH);
        state.width = width;
        state.moved = Math.abs(event.clientX - state.startX) > 1;
        const node = nodes.current.get(state.id);
        if (node) node.style.width = `${Math.round(width)}px`;
      }
    },
    [camera, gridSize, snapEnabled],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent) => {
      if (touches.current.has(event.pointerId)) touches.current.delete(event.pointerId);
      const state = gesture.current;
      if (!state) return;

      if (state.kind === "pinch") {
        if (touches.current.size >= 2) return;
        if (touches.current.size === 1) {
          const [remaining] = [...touches.current.values()] as [{ x: number; y: number }];
          gesture.current = remaining
            ? { kind: "pan", pointerId: event.pointerId, lastX: remaining.x, lastY: remaining.y }
            : null;
          setBusy(gesture.current ? "pan" : "idle");
          return;
        }
        endGesture();
        return;
      }

      if ("pointerId" in state && event.pointerId !== state.pointerId) return;

      if (state.kind === "drag") {
        nodes.current.get(state.id)?.removeAttribute("data-dragging");
        if (state.moved && typeof state.x === "number" && typeof state.y === "number") {
          store.moveCard(state.id, { ...state.origin, x: state.x, y: state.y });
        }
      }

      if (state.kind === "resize") {
        const node = nodes.current.get(state.id);
        if (state.moved && typeof state.width === "number") store.setCardWidth(state.id, state.width);
        if (node) node.style.removeProperty("width");
      }

      endGesture();
    },
    [endGesture, store],
  );

  useEffect(() => {
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const fromCard = target.closest("[data-card-id]");
    const panningFromContent = event.button === 1 || (event.button === 0 && target.dataset.panSurface === "true");
    if (fromCard && !panningFromContent) return;
    if (event.button !== 0 && event.button !== 1) return;

    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (event.pointerType === "touch" && touches.current.size === 2) {
      beginPinch();
      return;
    }
    if (event.pointerType === "touch" && touches.current.size > 2) return;

    store.setSelected(null);
    store.setEditing(null);
    gesture.current = {
      kind: "pan",
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    setBusy("pan");
    if (event.pointerType !== "touch") document.body.style.cursor = "grabbing";
  };

  const beginDrag = useCallback(
    (event: ReactPointerEvent, id: string) => {
      if (event.button !== 0) return;
      const card = store.getState().cards[id];
      if (!card) return;
      event.stopPropagation();
      store.setSelected(id);
      store.setEditing(null);
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      gesture.current = {
        kind: "drag",
        id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origin: { ...card.position },
        moved: false,
      };
    },
    [store],
  );

  const beginResize = useCallback((event: ReactPointerEvent, id: string) => {
    if (event.button !== 0) return;
    const card = store.getState().cards[id];
    if (!card) return;
    event.stopPropagation();
    gesture.current = {
      kind: "resize",
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      originWidth: card.position.width ?? CARD_DEFAULT_WIDTH,
      moved: false,
    };
  }, [store]);

  const registerNode = useCallback((id: string, node: HTMLElement | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);

  const reportHeight = useCallback((id: string, height: number) => {
    const previous = heights.current.get(id);
    if (previous !== undefined && Math.abs(previous - height) < 1.5) return;
    heights.current.set(id, height);
  }, []);

  const rectOf = useCallback(
    (id: string): MeasuredRect | null => {
      const card = store.getState().cards[id];
      if (!card) return null;
      const base = cardRect(card) as Rect;
      return { ...base, height: heights.current.get(id) ?? base.height };
    },
    [store],
  );

  const value = useMemo<WorkspaceApi>(
    () => ({ camera, registerNode, reportHeight, rectOf, beginDrag, beginResize, precise }),
    [camera, registerNode, reportHeight, rectOf, beginDrag, beginResize, precise],
  );

  /** Dropping files anywhere on the Layer stores them at that point. */
  const onDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!dropping) setDropping(true);
  };

  const onDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDropping(false);
  };

  const onDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    setDropping(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const viewport = camera.getViewport();
    const x = (event.clientX - rect.left - viewport.x) / viewport.scale;
    const y = (event.clientY - rect.top - viewport.y) / viewport.scale;
    const files = Array.from(event.dataTransfer.files).slice(0, 12);
    // Sequential on purpose: each attachment is written before the next card is
    // placed, so a full-disk failure can't strand half the batch.
    void (async () => {
      for (const [index, file] of files.entries()) {
        await store.attachFile(layerId, file.type.startsWith("image/") ? "image" : "file", file, {
          x: x + index * 28,
          y: y + index * 28,
        });
      }
    })();
  };

  /** Double-click empty canvas: start thinking exactly there. */
  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-card-id]")) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const viewport = camera.getViewport();
    const x = (event.clientX - rect.left - viewport.x) / viewport.scale;
    const y = (event.clientY - rect.top - viewport.y) / viewport.scale - 18;
    store.addCard(layerId, "note", {
      position: { x: snapEnabled ? snapToGrid(x, gridSize) : x, y: snapEnabled ? snapToGrid(y, gridSize) : y },
    });
  };

  return (
    <WorkspaceContext.Provider value={value}>
      <div className="absolute inset-0">
        <div
          ref={canvasRef}
          data-layer-canvas
          data-busy={busy}
          data-dropping={dropping ? "true" : undefined}
          onPointerDown={onPointerDown}
          onDoubleClick={onDoubleClick}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          aria-label="Layer workspace. Drag the background to pan, pinch or ctrl plus scroll to zoom, double-click empty space to add a note."
          className={cn(
            "canvas-field absolute inset-0 overflow-hidden",
            busy === "pan" ? "cursor-grabbing" : busy === "idle" ? "cursor-grab" : "cursor-default",
          )}
          style={{ "--dot-opacity": 1 } as CSSProperties}
        >
          <div
            ref={worldRef}
            data-world
            className="absolute left-0 top-0 h-0 w-0 origin-top-left"
            style={{ "--card-ink": 1 } as CSSProperties}
          >
            {children}
          </div>
          {dropping ? (
            <div className="pointer-events-none absolute inset-3 z-40 grid place-items-end rounded-panel border-2 border-dashed border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_7%,transparent)] p-4">
              <p className="chrome mx-auto rounded-full border border-line px-3 py-1 text-[12px] font-medium text-ink">
                Drop to store in this Layer
              </p>
            </div>
          ) : null}
        </div>
        {overlay}
      </div>
    </WorkspaceContext.Provider>
  );
}
