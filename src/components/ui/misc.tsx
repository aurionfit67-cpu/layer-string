import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/** Keyboard hint. `<kbd>` gives screen readers the right semantics for free. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn("kbd", className)}>{children}</kbd>;
}

export type ChipTone = "neutral" | "accent" | "success" | "warning" | "danger";

const TONES: Record<ChipTone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  accent: "bg-accent-soft text-accent-ink border-transparent",
  success: "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-success border-transparent",
  warning: "bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-warning border-transparent",
  danger: "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger border-transparent",
};

export function Chip({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-[1px] text-[11px] font-medium leading-[1.35]",
        "[&>svg]:h-3 [&>svg]:w-3",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Text that exists for assistive tech only. */
export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

export function Divider({ className }: { className?: string }) {
  return <div role="presentation" className={cn("h-px w-full bg-line", className)} />;
}
