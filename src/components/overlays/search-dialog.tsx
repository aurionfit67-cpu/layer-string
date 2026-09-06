"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { useRoster } from "@/hooks/use-roster";
import { useAppState, useStore } from "@/lib/state/provider";
import { searchWorkspace, type SearchHit } from "@/lib/state/selectors";
import { CARD_KIND_LABEL } from "@/lib/types";
import { CardIcon, LayerIcon } from "@/lib/workspace/icons";
import { cn } from "@/lib/utils/cn";
import { splitHighlighted, substringMatches } from "@/lib/utils/fuzzy";
import { truncate } from "@/lib/utils/format";

/**
 * Search is a first-class action (not just a palette mode) because it is the
 * thing people reach for when a workspace grows: type a word, jump to the card
 * that holds it, wherever in which Layer it happens to live.
 */
export function SearchDialog() {
  const store = useStore();
  const router = useRouter();
  const open = useAppState((state) => state.overlay === "search");
  const layers = useAppState((state) => state.layers);
  const cards = useAppState((state) => state.cards);
  const order = useAppState((state) => state.cardOrder);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    // Cleared here rather than in an effect on `open`, so the next ⌘⇧F starts from
    // an empty field without a second render to tidy up.
    store.setOverlay(null);
    setQuery("");
  }, [store]);

  const hits = useMemo(() => searchWorkspace(query.trim(), layers, cards, order, { limit: 40 }), [cards, layers, order, query]);
  const { index, setIndex, move } = useRoster(hits.length, listRef);

  const openHit = useCallback(
    (hit: SearchHit) => {
      store.setOverlay(null);
      setQuery("");
      if (hit.type === "layer") {
        store.openLayer(hit.layerId);
        router.push(`/layers/${hit.layerId}`);
        return;
      }
      store.requestReveal(hit.layerId, hit.cardId);
      router.push(`/layers/${hit.layerId}`);
    },
    [router, store],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const hit of hits) {
      const bucket = map.get(hit.layerName);
      if (bucket) bucket.push(hit);
      else map.set(hit.layerName, [hit]);
    }
    return [...map.entries()];
  }, [hits]);

  if (!open) return null;
  const terms = query.trim();

  return (
    <Modal open={open} onClose={close} align="top" className="w-[min(94vw,660px)]">
      <div className="flex items-center gap-2.5 border-b border-line/70 px-4 py-3">
        <span className="text-faint" aria-hidden>
          <SearchGlyph />
        </span>
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              move(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              move(-1);
            } else if (event.key === "Enter" && hits[index]) {
              event.preventDefault();
              openHit(hits[index]);
            }
          }}
          placeholder="Search Layers, notes, tasks, links, files…"
          aria-label="Search everything in LAYER"
          role="combobox"
          aria-expanded
          aria-controls="layer-search-results"
          aria-autocomplete="list"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
        />
        <span className="shrink-0 font-mono text-[10.5px] text-faint">{terms ? `${hits.length}` : ""}</span>
      </div>

      <div
        ref={listRef}
        id="layer-search-results"
        role="listbox"
        aria-label="Search results"
        data-scroll
        className="max-h-[min(60vh,520px)] min-h-[132px] overflow-y-auto p-1.5"
      >
        {terms.length === 0 ? (
          <div className="px-3 py-6">
            <p className="eyebrow mb-2">Jump to a Layer</p>
            {layers.length === 0 ? (
              <p className="text-[12.5px] text-muted">Nothing to search yet — create a Layer first.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {layers.slice(0, 12).map((layer) => (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => {
                        store.openLayer(layer.id);
                        store.setOverlay(null);
                        router.push(`/layers/${layer.id}`);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-ink"
                    >
                      <LayerIcon icon={layer.icon} size={12} />
                      {layer.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
        ) : hits.length === 0 ? (
          <p className="px-3 py-10 text-center text-[13px] text-muted">
            No Layer, card, link or file mentions “{truncate(terms, 60)}”.
          </p>
        ) : (
          grouped.map(([layerName, items]) => (
            <div key={layerName} className="mb-1.5 last:mb-0">
              <p className="eyebrow truncate px-2.5 pb-1 pt-2">{layerName}</p>
              {items.map((hit) => {
                const at = hits.indexOf(hit);
                const active = at === index;
                const icon =
                  hit.type === "layer" ? (
                    <LayerIcon icon={layers.find((candidate) => candidate.id === hit.layerId)?.icon} size={14} />
                  ) : (
                    <CardIcon kind={hit.cardKind} size={14} />
                  );
                const preview = hit.type === "card" ? hit.preview : "";
                const ranges = preview ? substringMatches(terms, preview) : [];
                return (
                  <button
                    key={hit.key}
                    type="button"
                    role="option"
                    data-roster={at}
                    aria-selected={active}
                    onMouseMove={() => setIndex(at)}
                    onClick={() => openHit(hit)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition-colors",
                      active ? "bg-surface-3" : "hover:bg-surface-2",
                    )}
                  >
                    <span className="mt-[2px] grid h-5 w-5 shrink-0 place-items-center text-faint [&>svg]:h-3.5 [&>svg]:w-3.5">
                      {icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{highlight(terms, hit.title)}</span>
                      {preview ? (
                        <span className="mt-0.5 block truncate text-[11.5px] text-muted">{highlight(terms, preview, ranges)}</span>
                      ) : (
                        <span className="mt-0.5 block truncate text-[11.5px] text-faint">
                          {hit.type === "layer" ? hit.subtitle : CARD_KIND_LABEL[hit.cardKind]}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between border-t border-line/70 bg-surface-2 px-4 py-2 text-[11px] text-faint">
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd>
            <kbd className="kbd">↵</kbd>
            open
          </span>
        </span>
        <span>Local only · no index, no server</span>
      </div>
    </Modal>
  );
}

function highlight(query: string, text: string, ranges?: ReturnType<typeof substringMatches>) {
  const parts = splitHighlighted(text, ranges ?? substringMatches(query, text));
  return (
    <>
      {parts.map((part, i) =>
        part.hit ? (
          <mark key={i} className="rounded-[3px] bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] px-px text-ink">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" strokeLinecap="round" />
    </svg>
  );
}
