"use client";

import { ExternalLink } from "lucide-react";

import { useStore } from "@/lib/state/provider";
import type { LinkCard } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { safeExternalUrl, urlHost } from "@/lib/utils/url";

/**
 * Link: the URL is stored exactly as typed and only becomes an href after
 * `safeExternalUrl()` accepts it — javascript:, data: and friends can never
 * reach an anchor, and a half-written address survives a reload.
 */
export function LinkCardBody({ card }: { card: LinkCard }) {
  const store = useStore();
  const href = safeExternalUrl(card.data.url);
  const host = urlHost(card.data.url || "");

  return (
    <div className="grid gap-1">
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="accent-soft mt-[2px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] text-[10px] font-bold uppercase"
        >
          {(host || "?").slice(0, 1)}
        </span>
        <input
          data-primary
          data-no-drag
          value={card.title}
          placeholder="Link title"
          aria-label="Link title"
          onChange={(event) => store.updateCard(card.id, { title: event.target.value })}
          className="quiet-field min-w-0 flex-1 px-1 py-0.5 text-[13.5px] font-medium text-ink"
        />
      </div>
      <input
        data-no-drag
        value={card.data.url}
        placeholder="https://…"
        aria-label="URL"
        spellCheck={false}
        inputMode="url"
        autoComplete="off"
        onChange={(event) => store.updateCard(card.id, { data: { url: event.target.value } })}
        className={cn(
          "quiet-field min-w-0 px-1 py-0.5 font-mono text-[11.5px]",
          card.data.url && !href ? "text-danger" : "text-muted",
        )}
      />
      {card.data.url && !href ? (
        <p role="status" className="px-1 text-[11px] text-danger">
          Not a usable URL yet — http(s) or mailto only.
        </p>
      ) : null}
      {card.data.description || href ? (
        <input
          data-no-drag
          value={card.data.description}
          placeholder="Why it's here (optional)"
          aria-label="Link note"
          onChange={(event) => store.updateCard(card.id, { data: { description: event.target.value } })}
          className="quiet-field px-1 py-0.5 text-[11.5px] text-faint"
        />
      ) : null}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          data-no-drag
          className="mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-1 text-[11.5px] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          <ExternalLink size={11} aria-hidden />
          Open {host || "link"}
        </a>
      ) : null}
    </div>
  );
}
