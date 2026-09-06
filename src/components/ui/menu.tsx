"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils/cn";
import { useDismiss } from "@/hooks/use-dismiss";

export type MenuEntry =
  | { type: "separator" }
  | { type: "label"; label: string }
  | {
      type?: "item";
      label: string;
      hint?: string;
      icon?: ReactNode;
      tone?: "default" | "danger";
      disabled?: boolean;
      onSelect: () => void;
    };

export type MenuProps = {
  label: string;
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode;
  entries: MenuEntry[];
  align?: "start" | "end";
  className?: string;
};

/**
 * Small purpose-built dropdown: button + listbox semantics, roving focus with
 * arrow keys, Escape and outside click to dismiss. Nothing here needs a
 * floating-ui dependency because every menu is anchored inside its own chrome.
 */
export function Menu({ label, trigger, entries, align = "end", className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const id = useId();
  const ref = useDismiss(open, () => setOpen(false));
  const items = entries.filter(
    (entry): entry is Extract<MenuEntry, { type?: "item" }> =>
      entry.type !== "separator" && entry.type !== "label" && "onSelect" in entry,
  );

  useEffect(() => {
    if (!open) return;
    const first = listRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])");
    first?.focus();
  }, [open]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const focusable = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [])];
    if (focusable.length === 0) return;
    const index = focusable.findIndex((node) => node === document.activeElement);
    const move = (delta: number) => {
      event.preventDefault();
      const next = focusable[(index + delta + focusable.length) % focusable.length];
      next?.focus();
    };
    if (event.key === "ArrowDown") move(1);
    else if (event.key === "ArrowUp") move(-1);
    else if (event.key === "Home") move(-index);
    else if (event.key === "End") move(focusable.length - 1 - index);
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      {trigger({
        open,
        id,
        toggle: () => {
          setOpen((value) => !value);
        },
      })}
      {open ? (
        <div
          ref={listRef}
          role="menu"
          aria-labelledby={id}
          aria-label={label}
          onKeyDown={onKeyDown}
          className={cn(
            "chrome-solid absolute top-[calc(100%+6px)] z-40 min-w-[212px] animate-pop rounded-xl border border-line p-1.5 shadow-float",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {entries.map((entry, index) => {
            if (entry.type === "separator") {
              return <div key={`sep-${index}`} role="separator" className="my-1 h-px bg-line" />;
            }
            if (entry.type === "label") {
              return (
                <p key={`label-${index}`} className="eyebrow px-2 pb-1 pt-1.5">
                  {entry.label}
                </p>
              );
            }
            return (
              <button
                key={entry.label}
                type="button"
                role="menuitem"
                disabled={entry.disabled}
                onClick={() => {
                  setOpen(false);
                  entry.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors",
                  "disabled:pointer-events-none disabled:opacity-40",
                  entry.tone === "danger"
                    ? "text-danger hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]"
                    : "text-ink hover:bg-surface-3",
                )}
              >
                {entry.icon ? <span className="text-faint [&>svg]:h-4 [&>svg]:w-4">{entry.icon}</span> : null}
                <span className="flex-1 truncate">{entry.label}</span>
                {entry.hint ? <span className="kbd">{entry.hint}</span> : null}
              </button>
            );
          })}
          {items.length === 0 ? <p className="px-2 py-1.5 text-xs text-faint">Nothing here</p> : null}
        </div>
      ) : null}
    </div>
  );
}
