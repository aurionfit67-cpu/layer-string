"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useAppState, useStore } from "@/lib/state/provider";
import { cn } from "@/lib/utils/cn";

/**
 * Never pretend a save happened. If IndexedDB was refused, or a write failed
 * half-way (quota, corrupt database), this says what is happening and offers the
 * one recovery that works from a browser: export what you have.
 */
export function StorageBanner() {
  const store = useStore();
  const storage = useAppState((state) => state.storage);
  const status = useAppState((state) => state.status);
  const inWorkspace = useAppState((state) => state.openLayerId !== null);
  // A dismissal is recorded against the exact problem it dismissed, so the next
  // distinct failure — or a retry that does not work — brings the banner back.
  const signature = `${storage.kind}:${storage.writable ? "ok" : "ro"}:${storage.message ?? ""}`;
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  if (status === "boot" || dismissedFor === signature) return null;

  const degraded = storage.kind !== "indexeddb";
  const unwritable = !storage.writable;
  const message =
    storage.message ??
    (degraded
      ? "LAYER is using a fallback store, which is smaller and can be cleared by the browser."
      : "The last write to local storage failed.");

  return (
    <div
      role={unwritable ? "alert" : "status"}
      className={cn(
        "fixed z-40 flex w-[min(94vw,620px)] -translate-x-1/2 items-start gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-float animate-rise left-1/2",
        inWorkspace ? "top-[58px]" : "top-3",
        unwritable
          ? "border-[color-mix(in_srgb,var(--danger)_45%,var(--line))] bg-[color-mix(in_srgb,var(--danger)_9%,var(--surface))]"
          : "border-[color-mix(in_srgb,var(--warning)_45%,var(--line))] bg-[color-mix(in_srgb,var(--warning)_10%,var(--surface))]",
      )}
    >
      <span className={cn("mt-[3px] h-2 w-2 shrink-0 rounded-full", unwritable ? "bg-danger" : "bg-warning")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-ink">
          {unwritable ? "Changes are not being saved" : degraded ? "Using a fallback storage" : "Local storage needs attention"}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{message}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => void store.retryStorage()}>
            Try again
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissedFor(signature)}>
            Ignore for now
          </Button>
        </div>
      </div>
    </div>
  );
}
