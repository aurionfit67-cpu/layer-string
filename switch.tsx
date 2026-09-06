"use client";

import { cn } from "@/lib/utils/cn";

export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  className?: string;
};

/** Settings toggle: a real switch role, so screen readers say "on"/"off". */
export function Switch({ checked, onChange, label, description, className }: SwitchProps) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 py-1.5", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={description ? undefined : label}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full border p-[2px] transition-colors duration-200",
          checked ? "border-transparent bg-accent" : "border-line bg-surface-3",
        )}
      >
        <span
          className={cn(
            "block h-[12px] w-[12px] rounded-full bg-surface shadow-sm transition-transform duration-200",
            checked ? "translate-x-[14px]" : "translate-x-0",
          )}
        />
      </button>
      <span className="grid gap-0.5">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {description ? <span className="text-[11px] leading-snug text-faint">{description}</span> : null}
      </span>
    </label>
  );
}
