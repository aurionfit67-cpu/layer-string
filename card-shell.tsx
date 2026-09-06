"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { CardMenu } from "./card-menu";
import { IDLE_WORKSPACE, useOptionalWorkspace } from "./workspace-canvas";
import { useAppState, useStore } from "@/lib/state/provider";
import { CARD_KIND_LABEL, type Card } from "@/lib/types";
import { CardIcon } from "@/lib/workspace/icons";
import { snapToGrid } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatRelativeTime } from "@/lib/utils/format";

export type CardShellProps = {
  card: Card;
  children: ReactNode;
  /** Rendered in the header, right of the title area. */
  aside?: ReactNode;
  accentLabel?: string;
  /** canvas = spatial placement; list = stacked, mobile-friendly reading. */
  mode?: "canvas" | "list";
};

/**
 * One frame for every card type: world-space placement, the drag surface, the
 * menu, the measured height, and the selection/focus behaviour that keyboard
 * users need. Type-specific bodies stay small because nothing here repeats.
 */
export function CardShell({ card, children, aside, accentLabel, mode = "canvas" }: CardShellProps) {
  const store = useStore();
  const canvas = useOptionalWorkspace();
  // Stable identities, so the effects below do not re-run on every render.
  const { registerNode, reportHeight, beginDrag, beginResize, precise } = useMemo(
    () => canvas ?? IDLE_WORKSPACE,
    [canvas],
  );
  const ref = useRef<HTMLDivElement | null>(null);
  const selected = useAppState((state) => state.selectedCardId === card.id);
  const editing = useAppState((state) => state.editingCardId === card.id);
  const flash = useAppState((state) => state.focusCardId === card.id);
  const showMeta = useAppState((state) => state.settings.showCardMeta);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    registerNode(card.id, ref.current);
    return () => registerNode(card.id, null);
  }, [card.id, registerNode]);

  // Cards size to content; the measured height feeds "fit", hit-testing and the
  // Layer preview. Deliberately kept out of the store: it is derived, not data.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      reportHeight(card.id, node.offsetHeight);
    });
    observer.observe(node);
    reportHeight(card.id, node.offsetHeight);
    return () => observer.disconnect();
  }, [card.id, reportHeight]);

  // A reveal from search or the palette in list mode has no camera to move, so the
  // scroller is the thing that has to come to the card instead.
  useEffect(() => {
    if (!flash || mode !== "list") return;
    ref.current?.scrollIntoView({ block: "center", behavior: prefersReduced() ? "auto" : "smooth" });
  }, [flash, mode]);

  // Entering edit mode focuses the primary field of whichever card it is.
  useEffect(() => {
    if (!editing) return;
    const node = ref.current?.querySelector<HTMLElement>("[data-primary]");
    node?.focus({ preventScroll: true });
  }, [editing, card.id]);

  const onDragPointerDown = (event: ReactPointerEvent) => {
    beginDrag(event, card.id);
  };

  const onHandleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 1 : (store.getState().settings.gridSize || 24);
    const move = (dx: number, dy: number) => {
      event.preventDefault();
      event.stopPropagation();
      store.moveCard(card.id, {
        ...card.position,
        x: snapToGrid(card.position.x + dx * step, step),
        y: snapToGrid(card.position.y + dy * step, step),
      });
    };
    switch (event.key) {
      case "ArrowLeft":
        move(-1, 0);
        break;
      case "ArrowRight":
        move(1, 0);
        break;
      case "ArrowUp":
        move(0, -1);
        break;
      case "ArrowDown":
        move(0, 1);
        break;
      case "Enter":
      case "F2":
        event.preventDefault();
        store.setEditing(card.id);
        break;
      case "Delete":
      case "Backspace":
        if (event.key === "Backspace" && !event.shiftKey) return;
        event.preventDefault();
        store.deleteCard(card.id);
        break;
      default:
        break;
    }
  };

  const onFocus = () => store.setSelected(card.id);

  const width = card.position.width;

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      data-selected={selected ? "true" : "false"}
      data-editing={editing ? "true" : "false"}
      data-flash={flash ? "true" : "false"}
      onPointerEnter={precise ? () => setHovered(true) : undefined}
      onPointerLeave={precise ? () => setHovered(false) : undefined}
      onFocus={onFocus}
      style={
        mode === "canvas"
          ? {
              transform: `translate3d(${card.position.x}px, ${card.position.y}px, 0)`,
              width: width ? `${width}px` : undefined,
              zIndex: (card.position.z ?? 0) + 10 + (editing ? 2000 : selected ? 1000 : 0),
            }
          : undefined
      }
      className={cn(
        "card-plate card-shell flex flex-col rounded-card",
        mode === "canvas" ? "absolute left-0 top-0" : "relative w-full",
        "origin-top-left transition-[box-shadow,border-color] duration-150",
        "[ &[data-dragging=true] ]:transition-none",
        "focus-within:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))]",
      )}
    >
      <div
        className="group/header flex items-center gap-1.5 rounded-t-card px-2 pt-1.5 pb-1"
        data-pan-surface={mode === "canvas" ? "true" : undefined}
        onPointerDown={mode === "canvas" ? onDragPointerDown : undefined}
      >
        {mode === "canvas" ? (
          <DragHandle label={`Move ${card.kind} card. Arrow keys nudge, Enter edits.`} onKeyDown={onHandleKeyDown} />
        ) : (
          <span className="inline-flex h-[18px] items-center gap-1 text-[10px] text-faint">
            <CardIcon kind={card.kind} size={11} />
            {CARD_KIND_LABEL[card.kind]}
          </span>
        )}
        <span className="accent-soft inline-flex h-[18px] items-center gap-1 rounded-md px-1.5 text-[10px] font-semibold tracking-[0.06em] uppercase select-none">
          <CardIcon kind={card.kind} size={11} strokeWidth={2} />
          {accentLabel ?? CARD_KIND_LABEL[card.kind]}
        </span>
        {showMeta && (hovered || selected) ? (
          <span className="ml-1 truncate text-[10px] text-faint tabular-nums">
            {formatRelativeTime(card.updatedAt)}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-0.5" data-no-drag>
          {aside}
          <CardMenu card={card} visible={hovered || selected || !precise} />
        </div>
      </div>

      <div className="card-body px-2.5 pb-2.5">{children}</div>

      {mode === "canvas" && precise ? (
        <ResizeGrip onPointerDown={(event) => beginResize(event, card.id)} visible={hovered || selected} />
      ) : null}
    </div>
  );
}

function DragHandle({
  label,
  onKeyDown,
}: {
  label: string;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-tooltip="Drag to move · arrows nudge"
      data-tooltip-side="left"
      onKeyDown={onKeyDown}
      className={cn(
        "grid h-6 w-5 shrink-0 place-items-center rounded-md text-faint transition-colors",
        "hover:bg-surface-3 hover:text-muted focus-visible:text-muted",
      )}
    >
      <svg width="9" height="13" viewBox="0 0 9 13" fill="currentColor" aria-hidden>
        {[1.5, 6.5].map((cx) =>
          [1.5, 6.5, 11.5].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1" />),
        )}
      </svg>
    </button>
  );
}

function ResizeGrip({
  onPointerDown,
  visible,
}: {
  onPointerDown: (event: ReactPointerEvent) => void;
  visible: boolean;
}) {
  return (
    <button
      type="button"
      aria-label="Resize card width"
      data-no-drag
      onPointerDown={onPointerDown}
      className={cn(
        "absolute -bottom-px -right-px h-4 w-4 cursor-ew-resize rounded-br-card transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <span className="absolute right-[3px] bottom-[3px] h-[7px] w-[7px] border-r border-b border-line-strong" />
    </button>
  );
}

/** Shared editable title input used by every card kind. */
export function CardTitle({ card, placeholder }: { card: Card; placeholder: string }) {
  const store = useStore();
  const onChange = useCallback(
    (value: string) => store.updateCard(card.id, { title: value }),
    [card.id, store],
  );
  return (
    <input
      data-primary
      data-no-drag
      value={card.title}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={`${CARD_KIND_LABEL[card.kind]} title`}
      className="quiet-field w-full px-1.5 py-1 text-[13.5px] font-semibold tracking-[-0.01em] text-ink"
      spellCheck={false}
    />
  );
}

function prefersReduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
