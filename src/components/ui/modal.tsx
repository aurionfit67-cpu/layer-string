"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  titleId?: string;
  children: ReactNode;
  className?: string;
  /** Dialogs that need the click-outside-to-close behaviour on the backdrop. */
  dismissOnBackdrop?: boolean;
  align?: "center" | "top";
  /**
   * `alertdialog` for confirmations that destroy something, so a screen reader
   * interrupts instead of politely announcing. `<dialog>` allows either value.
   */
  role?: "dialog" | "alertdialog";
};

/**
 * Native `<dialog>`: focus trapping, background inertness and Escape-to-close
 * come from the platform, which is more correct than anything I would hand-roll
 * and costs nothing in the bundle.
 */
export function Modal({
  open,
  onClose,
  titleId,
  children,
  className,
  dismissOnBackdrop = true,
  align = "center",
  role,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  const handleCancel = useCallback(
    (event: { preventDefault: () => void }) => {
      // Escape fires `cancel`; own it so the overlay store never also closes.
      event.preventDefault();
      onClose();
    },
    [onClose],
  );

  return (
    <dialog
      ref={ref}
      role={role}
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClick={(event) => {
        if (!dismissOnBackdrop) return;
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "m-auto hidden h-fit max-h-[min(88vh,900px)] w-[min(94vw,640px)] flex-col overflow-hidden",
        "rounded-panel border border-line bg-surface text-ink shadow-float open:flex",
        "[&::backdrop]:bg-[color-mix(in_srgb,var(--canvas-deep)_62%,transparent)] [&::backdrop]:backdrop-blur-[3px]",
        "animate-pop",
        align === "top" ? "mt-[7vh]" : "",
        className,
      )}
    >
      {children}
    </dialog>
  );
}

export function ModalHeader({
  title,
  description,
  right,
  id,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
  id?: string;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4">
      <div className="grid gap-1">
        <h2 id={id} className="text-[15px] font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {description ? <p className="text-xs text-muted">{description}</p> : null}
      </div>
      {right}
    </header>
  );
}

export function ModalBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-scroll className={cn("min-h-0 overflow-y-auto px-5 py-4", className)}>
      {children}
    </div>
  );
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="flex items-center justify-end gap-2 border-t border-line/70 bg-surface-2 px-5 py-3">
      {children}
    </footer>
  );
}
