"use client";

import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/state/provider";

/**
 * Shown when nothing could be opened at all. This is a real state, not a mock:
 * private windows and blocked-storage policies do hit it, and the copy tells the
 * user exactly what to change instead of blaming "an error".
 */
export function FatalStorage({ message }: { message: string | null }) {
  const store = useStore();
  return (
    <main className="canvas-field relative grid min-h-dvh place-items-center px-6 py-16">
      <div className="max-w-[520px]">
        <p className="eyebrow text-danger">Storage blocked</p>
        <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.025em] text-ink">
          LAYER can&rsquo;t open local storage in this browser
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          {message ?? "IndexedDB and localStorage are both unavailable, so there is nowhere to keep your Layers."}
        </p>
        <ul className="mt-4 grid gap-1.5 text-[13px] text-muted">
          {[
            "Turn off “Block all cookies” for this site, or leave private browsing.",
            "On iPadOS private tabs and some hardened browser profiles, storage is disabled per tab.",
            "If a group policy or extension is blocking storage, allow this origin and reload.",
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-faint" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-2">
          <Button variant="primary" size="sm" onClick={() => void store.retryStorage()}>
            Try again
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
            Reload LAYER
          </Button>
        </div>
      </div>
    </main>
  );
}
