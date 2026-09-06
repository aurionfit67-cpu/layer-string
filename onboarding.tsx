"use client";

import { Button } from "@/components/ui/button";
import { Combo } from "@/components/ui/combo";
import { useStore } from "@/lib/state/provider";

/**
 * First run. Three sentences, two buttons, no carousel: the idea is either
 * obvious from "Try an example" or it is not for this person.
 */
export function Onboarding() {
  const store = useStore();

  const tryExample = () => {
    store.updateSettings({ onboarded: true });
    void (async () => {
      const layer = await store.seedDemoLayer();
      if (layer) store.openLayer(layer.id);
    })();
  };

  return (
    <main className="canvas-field relative grid min-h-dvh place-items-center overflow-hidden px-6 py-16">
      <div className="relative w-full max-w-[560px]">
        <p className="eyebrow">LAYER</p>
        <h1 className="mt-4 text-[clamp(30px,6.2vw,46px)] font-semibold leading-[1.06] tracking-[-0.035em] text-ink">
          Don&rsquo;t organize your apps.
          <br />
          <span className="text-muted">Organize what you&rsquo;re doing.</span>
        </h1>
        <p className="mt-4 max-w-[46ch] text-[14.5px] leading-relaxed text-muted">
          A Layer is one goal — Company Launch, Exam Preparation, a video, a client — with its notes, tasks,
          links and files laid out on a single canvas. Nothing else is on screen.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <Button variant="primary" size="lg" onClick={() => store.setLayerDialog({ mode: "create" })}>
            <PlusGlyph />
            Create your first Layer
          </Button>
          <Button variant="secondary" size="lg" onClick={tryExample}>
            Try an example
          </Button>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-faint">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            Stored in this browser. No account, no server, no keys.
          </span>
          <span className="flex items-center gap-1.5">
            Later <Combo keys={["Mod", "K"]} /> opens everything
          </span>
          <button
            type="button"
            onClick={() => store.updateSettings({ onboarded: true })}
            className="rounded px-1 text-[11.5px] underline decoration-line-strong underline-offset-2 transition-colors hover:text-muted"
          >
            Skip
          </button>
        </div>
      </div>
    </main>
  );
}

function PlusGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
    </svg>
  );
}
