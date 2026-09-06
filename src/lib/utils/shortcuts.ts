/**
 * One list of shortcuts. It is rendered verbatim in Settings → Keyboard and in
 * the "?" overlay, and implemented in components/layout/hotkeys.tsx. If a
 * shortcut is not in this file, it does not exist.
 */
export type ShortcutScope = "everywhere" | "workspace" | "card";

export type Shortcut = {
  /** "Mod" renders as ⌘ on macOS and Ctrl elsewhere. */
  keys: string[];
  label: string;
  scope: ShortcutScope;
};

export const SHORTCUTS: Shortcut[] = [
  { keys: ["Mod", "K"], label: "Command palette", scope: "everywhere" },
  { keys: ["Mod", "Shift", "F"], label: "Search Layers and cards", scope: "everywhere" },
  { keys: ["?"], label: "This list", scope: "everywhere" },
  { keys: ["Esc"], label: "Close a dialog, or drop the selection", scope: "everywhere" },
  { keys: ["N"], label: "New Layer (outside a Layer)", scope: "everywhere" },
  { keys: ["+"], label: "Zoom in", scope: "workspace" },
  { keys: ["-"], label: "Zoom out", scope: "workspace" },
  { keys: ["0"], label: "Zoom to 100%", scope: "workspace" },
  { keys: ["1"], label: "Fit the whole Layer to the screen", scope: "workspace" },
  { keys: ["N"], label: "New note, here", scope: "workspace" },
  { keys: ["T"], label: "Toggle grid snapping", scope: "workspace" },
  { keys: ["V"], label: "Switch canvas / list view", scope: "workspace" },
  { keys: ["D"], label: "Duplicate the selected card", scope: "workspace" },
  { keys: ["Delete"], label: "Delete the selected card", scope: "workspace" },
  { keys: ["Mod", "Z"], label: "Undo the last create, move or delete", scope: "workspace" },
  { keys: ["Arrows"], label: "Nudge the selected card", scope: "card" },
  { keys: ["Shift", "Arrows"], label: "Nudge by 1px", scope: "card" },
  { keys: ["Enter"], label: "Edit the focused card", scope: "card" },
];

export const SHORTCUT_SCOPES: Record<ShortcutScope, string> = {
  everywhere: "Anywhere",
  workspace: "Inside a Layer",
  card: "When a card is selected",
};
