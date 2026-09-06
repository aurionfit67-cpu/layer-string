"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Route-level boundary. Reaching it is a bug, not a user error, so the message
 * shows the real reason and offers a reset instead of pretending everything is
 * fine. Card-level failures have their own narrower boundary and never land here.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[layer] route error", error);
  }, [error]);

  return (
    <main className="canvas-field grid min-h-dvh place-items-center px-6 py-16">
      <div className="max-w-[520px]">
        <p className="eyebrow text-danger">Something broke</p>
        <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.025em] text-ink">
          LAYER hit an error on this screen
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          Your data is untouched — it lives in this browser, not on a server. Try again, or go back to the list of
          Layers.
        </p>
        <pre className="mt-4 max-h-[9rem] overflow-auto rounded-[10px] border border-line bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed text-muted whitespace-pre-wrap">
          {error.message || "Unknown error"}
          {error.digest ? `\nref: ${error.digest}` : ""}
        </pre>
        <div className="mt-5 flex gap-2">
          <Button variant="primary" size="sm" onClick={reset}>
            Try again
          </Button>
          <Link
            href="/"
            className="inline-flex h-8 items-center rounded-[9px] px-3 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
