"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Copy,
  Download,
  LayoutList,
  Maximize,
  Pencil,
  Search,
  Trash,
  Undo,
  Grid2x2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Menu, type MenuEntry } from "@/components/ui/menu";
import { useCoarsePointer } from "@/hooks/use-media-query";
import { useTheme } from "@/hooks/use-theme";
import { exportSingleLayer } from "@/lib/state/data";
import { useAppState, useStore } from "@/lib/state/provider";
import { resolveViewMode } from "@/lib/state/selectors";
import type { Layer } from "@/lib/types";
import { LayerIcon } from "@/lib/workspace/icons";
import { ThemeGlyph } from "@/components/ui/theme-glyph";
import { cn } from "@/lib/utils/cn";
import { MAX_DESCRIPTION, MAX_NAME } from "@/lib/utils/format";

export type LayerHeaderProps = {
  layer: Layer;
  compact?: boolean;
};

/**
 * Layer identity plus the escape hatch out of it. The name and description are
 * edited in place — there is no "rename Layer" dialog anywhere in LAYER.
 */
export function LayerHeader({ layer, compact = false }: LayerHeaderProps) {
  const store = useStore();
  const router = useRouter();
  const cardCount = useAppState(
    (state) => state.cardOrder.filter((id) => state.cards[id]?.layerId === layer.id).length,
  );
  const mode = resolveViewMode(layer, useCoarsePointer());
  const snap = useAppState((state) => state.settings.snapToGrid);
  const undoDepth = useAppState((state) => state.undoDepth);
  const [confirming, setConfirming] = useState(false);
  const { resolved, cycle } = useTheme();

  const entries: MenuEntry[] = [
    {
      label: "Layer details",
      icon: <Pencil />,
      onSelect: () => store.setLayerDialog({ mode: "edit", layerId: layer.id }),
    },
    { label: mode === "canvas" ? "View as list" : "View as canvas", icon: <LayoutList />, onSelect: () => store.setViewMode(layer.id, mode === "canvas" ? "list" : "canvas") },
    { label: "Fit to content", icon: <Maximize />, onSelect: () => store.frameLayer(layer.id) },
    {
      label: snap ? "Snap to grid: on" : "Snap to grid: off",
      icon: <Grid2x2 />,
      onSelect: () => store.updateSettings({ snapToGrid: !snap }),
    },
    { type: "separator" },
    {
      label: "Duplicate Layer",
      icon: <Copy />,
      onSelect: () => {
        void store.duplicateLayer(layer.id).then((copy) => {
          if (copy) store.notify(`Duplicated as “${copy.name}”.`, { tone: "success" });
        });
      },
    },
    {
      label: "Export this Layer",
      icon: <Download />,
      onSelect: () => void exportSingleLayer(store, layer),
    },
    { type: "separator" },
    {
      label: "Delete Layer",
      icon: <Trash />,
      tone: "danger",
      onSelect: () => setConfirming(true),
    },
  ];

  return (
    <>
      <header
        className={cn(
          "chrome absolute inset-x-0 top-0 z-30 flex items-center gap-2 border-b border-line/70 px-2.5 py-2",
          compact ? "" : "md:gap-3 md:px-4 md:py-2.5",
        )}
      >
        <Link
          href="/layers"
          aria-label="Back to all Layers"
          data-tooltip="All Layers"
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-line bg-surface text-muted",
            "transition-colors hover:text-ink",
          )}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M9.5 3.5 5 8l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        <span
          aria-hidden
          className="accent-soft grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[13px]"
        >
          <LayerIcon icon={layer.icon} size={15} strokeWidth={1.9} />
        </span>

        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <input
            value={layer.name}
            aria-label="Layer name"
            data-scroll-x
            maxLength={MAX_NAME}
            onChange={(event) => store.updateLayer(layer.id, { name: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            style={{ width: `${Math.min(34, Math.max(6, layer.name.length + 1))}ch` }}
            className={cn(
              "quiet-field min-w-[6ch] shrink-0 truncate px-1 py-0.5 font-semibold tracking-[-0.015em] text-ink",
              compact ? "text-[15px]" : "text-[16px]",
            )}
          />
          <span className="hidden shrink-0 items-center gap-1.5 text-[11px] text-faint md:flex">
            <span className="font-mono tabular-nums">{cardCount}</span>
            <span aria-hidden>·</span>
            <input
              value={layer.description ?? ""}
              data-scroll-x
              maxLength={MAX_DESCRIPTION}
              placeholder="Add a description"
              aria-label="Layer description"
              onChange={(event) => store.updateLayer(layer.id, { description: event.target.value })}
              className="quiet-field w-[26ch] truncate px-1 py-0.5 text-[11px] text-muted placeholder:text-faint"
            />
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {undoDepth > 0 ? (
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => store.undo()}
              aria-label={`Undo. ${store.undoLabel() ?? ""}`}
              data-tooltip={store.undoLabel() ?? "Undo"}
            >
              <Undo size={14} aria-hidden />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => store.setOverlay("search")}
            aria-label="Search Layers and cards"
            data-tooltip="Search"
            className="hidden sm:inline-flex"
          >
            <Search size={14} aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={cycle}
            aria-label={`Switch theme. Currently ${resolved}.`}
            data-tooltip={`Theme: ${resolved}`}
            className="hidden sm:inline-flex"
          >
            <ThemeGlyph resolved={resolved} />
          </Button>
          <Menu
            label="Layer actions"
            align="end"
            entries={entries}
            trigger={({ toggle, open, id }) => (
              <Button
                id={id}
                variant="secondary"
                size="iconSm"
                aria-label="Layer actions"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={toggle}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
                  <circle cx="3.5" cy="8" r="1.3" />
                  <circle cx="8" cy="8" r="1.3" />
                  <circle cx="12.5" cy="8" r="1.3" />
                </svg>
              </Button>
            )}
          />
        </div>
      </header>

      <Confirm
        open={confirming}
        title={`Delete “${layer.name}”?`}
        tone="danger"
        confirmLabel="Delete Layer and its cards"
        body={
          <span>
            This removes the Layer and its {cardCount} card{cardCount === 1 ? "" : "s"} from local storage.
            You can undo this straight after, or export the Layer first.
          </span>
        }
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void store.deleteLayer(layer.id).then(() => router.push("/layers"));
        }}
      />
    </>
  );
}


