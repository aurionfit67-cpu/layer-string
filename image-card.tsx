"use client";

import { Image as ImageIcon, Maximize2 } from "lucide-react";

import { FileDrop } from "./file-drop";
import { CardTitle } from "@/components/workspace/card-shell";
import { useMediaUrl } from "@/hooks/use-media-url";
import { useStore } from "@/lib/state/provider";
import type { ImageCard } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatBytes } from "@/lib/utils/format";

/**
 * Image: bytes live in IndexedDB and are shown through a session object URL.
 * Nothing is uploaded anywhere, and a missing blob is a visible, fixable state
 * rather than a broken <img>.
 */
export function ImageCardBody({ card }: { card: ImageCard }) {
  const store = useStore();
  const { url, status } = useMediaUrl(card.data.mediaId);
  const ratio = card.data.width && card.data.height ? card.data.width / card.data.height : 0;

  if (!card.data.mediaId) {
    return (
      <div className="grid gap-1">
        <CardTitle card={card} placeholder="Image" />
        <FileDrop
          kind="image"
          label="Choose an image to store in this Layer"
          onFile={(file) => store.attachFile(card.layerId, "image", file, card.position)}
          className={cn(
            "mt-0.5 grid h-[92px] w-full place-items-center gap-1 rounded-[9px] border border-dashed border-line-strong",
            "bg-surface-2 text-[11.5px] text-faint transition-colors hover:border-[var(--accent)] hover:text-muted",
          )}
        >
          <span className="flex flex-col items-center gap-1">
            <ImageIcon size={16} aria-hidden />
            Add an image
          </span>
        </FileDrop>
      </div>
    );
  }

  return (
    <div className="grid gap-1">
      <CardTitle card={card} placeholder="Image" />
      <div className="relative mt-0.5 overflow-hidden rounded-[9px] border border-line bg-surface-2">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            data-no-drag
            className="group/img relative block"
            aria-label={`Open ${card.data.name || "image"} at full size`}
          >
            <img
              src={url}
              alt={card.data.alt || card.title || card.data.name || "Layer image"}
              loading="lazy"
              width={card.data.width || undefined}
              height={card.data.height || undefined}
              className={cn(
                "block max-h-[46vh] w-full object-contain transition-transform duration-200",
                "group-hover/img:brightness-[1.02]",
              )}
              style={ratio ? { aspectRatio: String(ratio) } : undefined}
            />
            <span className="chrome absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md border border-line text-muted opacity-0 transition-opacity group-hover/img:opacity-100">
              <Maximize2 size={12} aria-hidden />
            </span>
          </a>
        ) : status === "loading" ? (
          <div className="h-[120px] w-full animate-pulse bg-surface-3" />
        ) : (
          <div className="grid gap-1.5 p-3 text-[11.5px] text-danger">
            <span className="flex items-center gap-1.5">
              <ImageIcon size={12} aria-hidden />
              The stored bytes for this image are missing.
            </span>
            <FileDrop
              kind="image"
              label="Choose a replacement image"
              onFile={(file) => store.replaceFile(card.id, file)}
              className="w-fit rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:text-ink"
            >
              Choose another file
            </FileDrop>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          data-no-drag
          value={card.data.alt}
          onChange={(event) => store.updateCard(card.id, { data: { alt: event.target.value } })}
          placeholder="Describe this image"
          aria-label="Alternative text"
          className="quiet-field min-w-0 flex-1 px-1 py-0.5 text-[11.5px] text-faint"
        />
        {card.data.size ? (
          <span className="shrink-0 font-mono text-[10px] text-faint">{formatBytes(card.data.size)}</span>
        ) : null}
      </div>
    </div>
  );
}
