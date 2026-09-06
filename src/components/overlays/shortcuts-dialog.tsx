"use client";

import { Combo } from "@/components/ui/combo";
import { Modal, ModalBody, ModalHeader } from "@/components/ui/modal";
import { useAppState, useStore } from "@/lib/state/provider";
import { SHORTCUTS, SHORTCUT_SCOPES, type ShortcutScope } from "@/lib/utils/shortcuts";

/** Not a poster: every row here maps to a binding implemented in hotkeys.tsx. */
export function ShortcutsDialog() {
  const store = useStore();
  const open = useAppState((state) => state.overlay === "shortcuts");
  const groups: Array<{ scope: ShortcutScope; items: typeof SHORTCUTS }> = (
    ["everywhere", "workspace", "editing"] as ShortcutScope[]
  ).map((scope) => ({ scope, items: SHORTCUTS.filter((shortcut) => shortcut.scope === scope) }));

  return (
    <Modal open={open} onClose={() => store.setOverlay(null)} titleId="layer-shortcuts" className="w-[min(94vw,540px)]">
      <ModalHeader
        id="layer-shortcuts"
        title="Keyboard shortcuts"
        description="Typing inside a card is never interrupted: bindings are ignored while a field has focus."
      />
      <ModalBody className="grid gap-4 py-4">
        {groups.map((group) => (
          <section key={group.scope}>
            <p className="eyebrow mb-1.5">{SHORTCUT_SCOPES[group.scope]}</p>
            <ul className="grid">
              {group.items.map((shortcut) => (
                <li
                  key={`${shortcut.scope}-${shortcut.keys.join("-")}`}
                  className="flex items-center justify-between gap-4 border-b border-line/60 py-1.5 last:border-0"
                >
                  <span className="text-[12.5px] text-muted">{shortcut.label}</span>
                  <Combo keys={shortcut.keys} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="rounded-[9px] bg-surface-2 px-3 py-2 text-[11.5px] leading-relaxed text-faint">
          On the canvas: drag the background to pan, <span className="text-muted">⌘/Ctrl + scroll</span> or pinch to
          zoom, double-click empty space to write a note, and drop files anywhere to store them in the Layer.
        </p>
      </ModalBody>
    </Modal>
  );
}
