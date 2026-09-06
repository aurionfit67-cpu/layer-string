"use client";

import { CardTitle } from "@/components/workspace/card-shell";
import { Textarea } from "@/components/ui/field";
import { useStore } from "@/lib/state/provider";
import type { NoteCard } from "@/lib/types";
import { MAX_BODY } from "@/lib/utils/format";

/** Note: a title and a growing body, both live-edited. No save button anywhere. */
export function NoteCardBody({ card }: { card: NoteCard }) {
  const store = useStore();
  return (
    <div className="grid gap-0.5">
      <CardTitle card={card} placeholder="Note" />
      <Textarea
        data-no-drag
        data-scroll-y
        aria-label="Note body"
        value={card.data.body}
        maxLength={MAX_BODY}
        placeholder="Write it down…"
        onChange={(event) => store.updateCard(card.id, { body: event.target.value })}
        className="max-h-[46vh] overflow-y-auto px-1.5 py-1 text-muted"
      />
    </div>
  );
}
