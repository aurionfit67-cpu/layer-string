"use client";

import Link from "next/link";
import { Command, Search, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combo } from "@/components/ui/combo";
import { ThemeGlyph } from "@/components/ui/theme-glyph";
import { useTheme } from "@/hooks/use-theme";
import { useAppState, useStore } from "@/lib/state/provider";
import { cn } from "@/lib/utils/cn";

/** The wordmark bar shared by every non-workspace screen. */
export function TopBar({ className, crumb }: { className?: string; crumb?: string }) {
  const store = useStore();
  const { resolved, cycle } = useTheme();
  const count = useAppState((state) => state.layers.length);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center gap-3 border-b border-line/70 chrome px-4 py-2.5 md:px-7",
        className,
      )}
    >
      <Link href="/" className="flex items-center gap-2.5 rounded-md" aria-label="LAYER home">
        <LayerMark />
        <span className="text-[13px] font-semibold tracking-[0.22em] text-ink">LAYER</span>
      </Link>
      {crumb ? (
        <>
          <span className="text-faint" aria-hidden>
            /
          </span>
          <span className="text-[12.5px] text-muted">{crumb}</span>
        </>
      ) : null}

      <div className="ml-auto flex items-center gap-1.5">
        <span className="mr-1 hidden text-[11.5px] text-faint sm:inline">
          {count} {count === 1 ? "Layer" : "Layers"}
        </span>
        <button
          type="button"
          onClick={() => store.setOverlay("search")}
          className={cn(
            "hidden h-8 items-center gap-2 rounded-full border border-line bg-surface-2 px-2.5 text-[12px] text-faint",
            "transition-colors hover:border-line-strong hover:text-muted md:inline-flex",
          )}
          aria-label="Search Layers and cards"
        >
          <Search size={13} aria-hidden />
          Search
          <Combo keys={["Mod", "Shift", "F"]} />
        </button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => store.setOverlay("palette")}
          aria-label="Open the command palette"
          data-tooltip="Command palette"
        >
          <Command size={14} aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={cycle}
          aria-label={`Theme: ${resolved}. Activate to change appearance.`}
          data-tooltip={`Theme: ${resolved}`}
        >
          <ThemeGlyph resolved={resolved} />
        </Button>
        <Button href="/settings" variant="ghost" size="iconSm" aria-label="Settings" data-tooltip="Settings">
          <Settings size={14} aria-hidden />
        </Button>
      </div>
    </header>
  );
}

export function LayerMark({ size = 18 }: { size?: number }) {
  return (
    <span className="grid place-items-center" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 20 20" width={size} height={size}>
        <rect x="1" y="1" width="18" height="18" rx="5" fill="var(--ink)" />
        <rect x="5" y="5.4" width="10" height="2.2" rx="1.1" fill="var(--canvas)" />
        <rect x="5" y="9" width="7" height="2.2" rx="1.1" fill="var(--canvas)" opacity="0.72" />
        <rect x="5" y="12.6" width="4" height="2.2" rx="1.1" fill="var(--accent)" />
      </svg>
    </span>
  );
}

