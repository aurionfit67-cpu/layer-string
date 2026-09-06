"use client";

import { CircleAlert, CircleCheckBig, Info, TriangleAlert, X } from "lucide-react";

import { useAppState, useStore } from "@/lib/state/provider";
import { cn } from "@/lib/utils/cn";

const TONES = {
  info: Info,
  success: CircleCheckBig,
  warning: TriangleAlert,
  danger: CircleAlert,
} as const;

const TONE_CLASS = {
  info: "text-muted",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

/**
 * The only interrupting surface in LAYER. It doubles as the polite live region,
 * so actions like "Card deleted" are announced exactly once, with the Undo
 * control right there.
 */
export function Toast() {
  const store = useStore();
  const notice = useAppState((state) => state.notice);
  const inWorkspace = useAppState((state) => state.openLayerId !== null);
  if (!notice) return null;
  const Icon = TONES[notice.tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed z-50 flex items-center gap-2.5",
        "left-1/2 -translate-x-1/2",
        inWorkspace ? "bottom-[76px] md:bottom-5 md:left-5 md:translate-x-0" : "bottom-5 md:left-6 md:translate-x-0",
        "w-[min(92vw,430px)]",
      )}
    >
      <div className="chrome-solid flex w-full items-center gap-2.5 rounded-full border border-line px-3.5 py-2 shadow-float animate-rise">
        <Icon size={14} aria-hidden className={cn("shrink-0", TONE_CLASS[notice.tone])} />
        <p className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{notice.text}</p>
        {notice.action ? (
          <button
            type="button"
            onClick={() => {
              notice.action?.run();
              store.dismissNotice();
            }}
            className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink transition-colors hover:bg-surface-3"
          >
            {notice.action.label}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => store.dismissNotice()}
          aria-label="Dismiss message"
          className="shrink-0 rounded-full p-1 text-faint transition-colors hover:text-ink"
        >
          <X size={13} aria-hidden />
        </button>
      </div>
    </div>
  );
}
