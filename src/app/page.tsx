"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { FatalStorage } from "@/components/layout/fatal-storage";
import { TopBar } from "@/components/layout/top-bar";
import { LayerGrid, SortToggle, type SortKey } from "@/components/layers/layer-grid";
import { AppFooter } from "@/components/layout/footer";
import { Onboarding } from "@/components/sheets/onboarding";
import { Button } from "@/components/ui/button";
import { Combo } from "@/components/ui/combo";
import { useLayerState } from "@/lib/state/provider";

/**
 * Home. It is deliberately not a dashboard: one line about what LAYER is, the
 * Layers you already have, and a single action. The workspace is the product —
 * this is the door to it.
 */
export default function HomePage() {
  const { state, store } = useLayerState();
  const router = useRouter();
  const [sort, setSort] = useState<SortKey>("recent");
  const handledRef = useRef(false);

  // The PWA "New Layer" shortcut lands on /?new=1. Read straight off the location
  // rather than useSearchParams, so this page stays statically renderable, and
  // hand the URL back to the router once the dialog is open.
  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    if (new URLSearchParams(window.location.search).get("new") !== "1") return;
    store.updateSettings({ onboarded: true });
    store.setLayerDialog({ mode: "create" });
    router.replace("/");
  }, [router, store]);

  if (state.status === "error") return <FatalStorage message={state.fatalError} />;
  if (!state.settings.onboarded && state.layers.length === 0) return <Onboarding />;

  const hasLayers = state.layers.length > 0;

  return (
    <div className="canvas-field relative flex min-h-dvh flex-col">
      <TopBar />

      <section className="relative px-4 pb-9 pt-10 md:px-7 md:pb-12 md:pt-16">
        <p className="eyebrow">{hasLayers ? "Continue where you left off" : "Your workspace"}</p>
        <h1 className="mt-3 max-w-[26ch] text-[clamp(24px,4.6vw,40px)] font-semibold leading-[1.08] tracking-[-0.032em] text-balance">
          Stop opening apps.{" "}
          <span className="text-muted">Start opening what you&rsquo;re doing.</span>
        </h1>
        <p className="mt-3 max-w-[52ch] text-[13.5px] leading-relaxed text-muted">
          One goal, one Layer: notes, tasks, links and files laid out on a canvas you can actually think inside.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <Button variant="primary" size="lg" onClick={() => store.setLayerDialog({ mode: "create" })}>
            <PlusGlyph />
            New Layer
          </Button>
          <Button variant="secondary" size="lg" onClick={() => store.setOverlay("search")}>
            Search
          </Button>
          <span className="ml-0.5 hidden items-center gap-1.5 text-[11.5px] text-faint sm:flex">
            or press <Combo keys={["Mod", "K"]} /> for everything
          </span>
        </div>
      </section>

      <section className="relative flex-1 px-4 pb-16 md:px-7">
        <div className="mb-3 flex flex-wrap items-center gap-3 border-t border-line/70 pt-4">
          <h2 className="eyebrow">My Layers</h2>
          <span className="font-mono text-[11px] text-faint tabular-nums">{state.layers.length}</span>
          <div className="ml-auto flex items-center gap-2">
            <SortToggle value={sort} onChange={setSort} />
          </div>
        </div>
        <LayerGrid sort={sort} />
      </section>

      <AppFooter />
    </div>
  );
}

function PlusGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
    </svg>
  );
}
