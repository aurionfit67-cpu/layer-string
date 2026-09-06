"use client";

import {
  ArrowUpToLine,
  CalendarPlus,
  Copy,
  Link2Off,
  Pencil,
  Square,
  Trash,
} from "lucide-react";

import { Menu, type MenuEntry } from "@/components/ui/menu";
import { useStore } from "@/lib/state/provider";
import type { Card } from "@/lib/types";
import { safeExternalUrl } from "@/lib/utils/url";
import { copyText } from "@/lib/utils/clipboard";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { DAY } from "@/lib/workspace/time";

export type CardMenuProps = {
  card: Card;
  visible: boolean;
};

/** Per-kind actions. Every entry here does something real. */
export function CardMenu({ card, visible }: CardMenuProps) {
  const store = useStore();

  const entries: MenuEntry[] = [
    { label: "Edit text", icon: <Pencil />, onSelect: () => store.setEditing(card.id) },
    {
      label: "Duplicate",
      hint: "⌘D",
      icon: <Copy />,
      onSelect: () => store.duplicateCard(card.id),
    },
    { label: "Bring to front", icon: <ArrowUpToLine />, onSelect: () => store.bringToFront(card.id) },
  ];

  if (card.kind === "task") {
    entries.push({ type: "separator" });
    entries.push({
      label: card.data.dueAt > 0 ? "Move due date to tomorrow" : "Set due date: tomorrow",
      icon: <CalendarPlus />,
      // "Tomorrow" is resolved when the item is chosen, not when the menu is built.
      onSelect: () => {
        const tomorrow = Date.now() + DAY;
        store.updateCard(card.id, { data: { dueAt: card.data.dueAt > 0 ? card.data.dueAt + DAY : tomorrow } });
      },
    });
    entries.push({
      label: card.data.done ? "Mark as open" : "Mark as complete",
      onSelect: () => store.toggleTask(card.id),
    });
    entries.push({
      label: `Priority: ${card.data.priority}`,
      onSelect: () =>
        store.updateCard(card.id, {
          data: {
            priority:
              card.data.priority === "high" ? "low" : card.data.priority === "low" ? "none" : "high",
          },
        }),
    });
  }

  if (card.kind === "link" && safeExternalUrl(card.data.url)) {
    entries.push({ type: "separator" });
    entries.push({
      label: "Copy URL",
      icon: <Copy />,
      onSelect: async () => {
        const ok = await copyText(card.data.url);
        store.notify(ok ? "URL copied" : "The browser blocked clipboard access.", {
          tone: ok ? "success" : "warning",
        });
      },
    });
    if (card.data.url) {
      entries.push({
        label: "Clear URL",
        icon: <Link2Off />,
        onSelect: () => store.updateCard(card.id, { data: { url: "" } }),
      });
    }
  }

  if (card.kind === "image" || card.kind === "file") {
    const mediaId = "mediaId" in card.data ? card.data.mediaId : "";
    if (mediaId) {
      entries.push({ type: "separator" });
      entries.push({
        label: card.kind === "image" ? "Remove image" : "Remove file",
        icon: <Square />,
        onSelect: () => void store.detachMedia(card.id),
      });
    }
  }

  entries.push({ type: "separator" });
  entries.push({
    label: "Delete card",
    hint: "⌫",
    tone: "danger",
    icon: <Trash />,
    onSelect: () => store.deleteCard(card.id),
  });

  return (
    <Menu
      label={`Actions for ${card.kind} card`}
      align="end"
      entries={entries}
      trigger={({ toggle, open, id }) => (
        <Button
          variant="ghost"
          size="iconSm"
          id={id}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Card actions"
          onClick={toggle}
          className={cn(
            "transition-opacity duration-150",
            visible ? "opacity-100" : "opacity-0 focus-visible:opacity-100",
          )}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
            <circle cx="3.5" cy="8" r="1.3" />
            <circle cx="8" cy="8" r="1.3" />
            <circle cx="12.5" cy="8" r="1.3" />
          </svg>
        </Button>
      )}
    />
  );
}
