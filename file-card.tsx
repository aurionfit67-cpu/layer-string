"use client";

import { Download, FileText } from "lucide-react";

import { FileDrop } from "./file-drop";
import { CardTitle } from "@/components/workspace/card-shell";
import { useMediaUrl } from "@/hooks/use-media-url";
import { useStore } from "@/lib/state/provider";
import type { FileCard } from "@/lib/types";
import { formatBytes } from "@/lib/utils/format";

/**
 * File reference: the name, type and size are the record; the bytes ride along
 * in IndexedDB and are handed back through a blob URL when the user asks for
 * them. LAYER never previews arbitrary formats, because that would mean
 * trusting browser-rendered content from disk.
 */
export function FileCardBody({ card }: { card: FileCard }) {
  const store = useStore();
  const { url, status } = useMediaUrl(card.data.mediaId);

  if (!card.data.mediaId) {
    return (
      <div className="grid gap-1">
        <CardTitle card={card} placeholder="File" />
        <FileDrop
          kind="file"
          label="Choose a file to reference in this Layer"
          onFile={(file) => store.attachFile(card.layerId, "file", file, card.position)}
          className="mt-0.5 grid h-[62px] w-full place-items-center rounded-[9px] border border-dashed border-line-strong bg-surface-2 text-[11.5px] text-faint transition-colors hover:border-[var(--accent)] hover:text-muted"
        >
          <span className="flex items-center gap-1.5">
            <FileText size={14} aria-hidden />
            Attach a file
          </span>
        </FileDrop>
      </div>
    );
  }

  const extension = (card.data.name.split(".").pop() ?? "file").slice(0, 4).toUpperCase();

  return (
    <div className="grid gap-1">
      <CardTitle card={card} placeholder="File" />
      <div className="mt-0.5 flex items-center gap-2.5 rounded-[9px] border border-line bg-surface-2 p-2">
        <span className="accent-soft grid h-8 w-7 shrink-0 place-items-center rounded-[5px] text-[9px] font-bold tracking-tight">
          {extension}
        </span>
        <span className="grid min-w-0 flex-1">
          <span className="truncate text-[12.5px] font-medium text-ink" title={card.data.name}>
            {card.data.name || "Untitled file"}
          </span>
          <span className="truncate font-mono text-[10px] text-faint">
            {status === "missing"
              ? "bytes missing from local storage"
              : `${card.data.mime || "file"} · ${formatBytes(card.data.size)}`}
          </span>
        </span>
        {url ? (
          <a
            href={url}
            download={card.data.name || "layer-file"}
            data-no-drag
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-[11px] font-medium text-muted transition-colors hover:text-ink"
            aria-label={`Download ${card.data.name}`}
          >
            <Download size={11} aria-hidden />
            Save
          </a>
        ) : (
          <FileDrop
            kind="file"
            label="Choose the file again"
            onFile={(file) => store.replaceFile(card.id, file)}
            className="inline-flex h-7 shrink-0 items-center rounded-lg border border-line bg-surface px-2 text-[11px] font-medium text-danger"
          >
            Re-attach
          </FileDrop>
        )}
      </div>
      <input
        data-no-drag
        value={card.data.caption}
        onChange={(event) => store.updateCard(card.id, { data: { caption: event.target.value } })}
        placeholder="What is this for? (optional)"
        aria-label="File note"
        className="quiet-field px-1 py-0.5 text-[11.5px] text-faint"
      />
    </div>
  );
}
