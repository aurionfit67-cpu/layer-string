"use client";

import { memo } from "react";

import { FileCardBody } from "@/components/cards/file-card";
import { ImageCardBody } from "@/components/cards/image-card";
import { LinkCardBody } from "@/components/cards/link-card";
import { NoteCardBody } from "@/components/cards/note-card";
import { TaskCardBody } from "@/components/cards/task-card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useStore } from "@/lib/state/provider";
import type { Card } from "@/lib/types";
import { CardShell } from "./card-shell";

/**
 * Renders one card. Memoised on the record itself: a keystroke in card A must not
 * re-render cards B…Z, and during a drag nothing re-renders at all because the
 * canvas moves the DOM node directly.
 */
export const CardView = memo(function CardView({
  card,
  mode = "canvas",
}: {
  card: Card;
  mode?: "canvas" | "list";
}) {
  const store = useStore();
  return (
    <ErrorBoundary label={`“${card.kind}” card`} onDiscard={() => store.deleteCard(card.id)} resetKeys={[card.updatedAt]}>
      <CardShell card={card} mode={mode}>
        {renderBody(card)}
      </CardShell>
    </ErrorBoundary>
  );
});

function renderBody(card: Card) {
  switch (card.kind) {
    case "note":
      return <NoteCardBody card={card} />;
    case "task":
      return <TaskCardBody card={card} />;
    case "link":
      return <LinkCardBody card={card} />;
    case "image":
      return <ImageCardBody card={card} />;
    case "file":
      return <FileCardBody card={card} />;
    default:
      // Unreachable through the type system; kept honest for hand-edited data.
      return <p className="px-1 text-[11.5px] text-faint">Unknown card type.</p>;
  }
}
