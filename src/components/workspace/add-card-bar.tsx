"use client";

import { FileText, Image as ImageIcon, Link2, ListChecks, NotebookPen, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Menu, type MenuEntry } from "@/components/ui/menu";
import { useStore } from "@/lib/state/provider";
import type { CardKind } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

const KINDS: Array<{ kind: CardKind; label: string; icon: React.ReactNode; hint: string }> = [
  { kind: "note", label: "Note", icon: <NotebookPen />, hint: "N" },
  { kind: "task", label: "Task", icon: <ListChecks />, hint: "☐" },
  { kind: "link", label: "Link", icon: <Link2 />, hint: "↗" },
  { kind: "image", label: "Image", icon: <ImageIcon />, hint: "⌥" },
  { kind: "file", label: "File", icon: <FileText />, hint: "⇧" },
];

/**
 * Adding a card is the most repeated action in LAYER, so on desktop it is a
 * single visible pill with one click per type — no modal, no confirmations.
 * Files and images go straight to the OS picker.
 */
export function AddCardBar({ layerId, compact = false }: { layerId: string; compact?: boolean }) {
  const store = useStore();

  const pick = (kind: CardKind) => {
    if (kind === "image" || kind === "file") {
      store.requestMedia(kind, layerId);
      return;
    }
    store.addCard(layerId, kind);
  };

  if (compact) {
    const entries: MenuEntry[] = KINDS.map((item) => ({
      label: item.label,
      icon: item.icon,
      onSelect: () => pick(item.kind),
    }));
    return (
      <Menu
        label="Add to Layer"
        align="end"
        entries={entries}
        className="contents"
        trigger={({ toggle, open, id }) => (
          <Button
            id={id}
            variant="primary"
            size="md"
            onClick={toggle}
            aria-expanded={open}
            aria-haspopup="menu"
            className="rounded-full px-3.5 shadow-plate"
          >
            <Plus size={15} aria-hidden />
            Add
          </Button>
        )}
      />
    );
  }

  return (
    <div
      className="chrome flex items-center gap-0.5 rounded-full border border-line p-1 shadow-plate"
      role="group"
      aria-label="Add to Layer"
    >
      <span className="eyebrow pl-2 pr-1">Add</span>
      {KINDS.map((item) => (
        <button
          key={item.kind}
          type="button"
          onClick={() => pick(item.kind)}
          aria-label={`Add ${item.label.toLowerCase()}`}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-muted",
            "transition-colors hover:bg-surface-3 hover:text-ink",
            "[&>svg]:h-3.5 [&>svg]:w-3.5",
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
