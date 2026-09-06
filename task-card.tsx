"use client";

import { Calendar, Flag, X } from "lucide-react";

import { useStore } from "@/lib/state/provider";
import type { TaskCard } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatDay, formatTimeOfDay, isOverdue } from "@/lib/utils/format";

/**
 * Task: one card, one thing to do.
 *
 * The title is a real input (not a contenteditable) so autofill, IME and
 * announcements behave. Due date and priority are set from the card menu, so the
 * card body only ever shows information the user has actually entered.
 */
export function TaskCardBody({ card }: { card: TaskCard }) {
  const store = useStore();
  const { done, dueAt, priority } = card.data;
  const overdue = !done && isOverdue(dueAt);
  const showMeta = done || dueAt > 0 || priority !== "none";

  return (
    <div className="grid gap-1">
      <div className="flex items-start gap-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          data-no-drag
          aria-label={done ? "Mark task open" : "Mark task complete"}
          onClick={() => store.toggleTask(card.id)}
          className={cn(
            "mt-[3px] grid h-[17px] w-[17px] shrink-0 place-items-center rounded-[5px] border transition-colors duration-150",
            done
              ? "border-transparent bg-[var(--success)] text-[var(--surface)]"
              : "border-line-strong bg-surface hover:border-[var(--muted)]",
          )}
        >
          <svg
            viewBox="0 0 14 14"
            width="10"
            height="10"
            aria-hidden
            className={cn("transition-opacity duration-150", done ? "opacity-100" : "opacity-0")}
          >
            <path
              d="M2.5 7.5 5.5 10.5 11.5 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <input
          data-primary
          data-no-drag
          value={card.title}
          aria-label="Task"
          placeholder="Do this"
          onChange={(event) => store.updateCard(card.id, { title: event.target.value })}
          className={cn(
            "quiet-field min-w-0 flex-1 px-1 py-0.5 text-[13.5px] font-medium",
            done
              ? "text-faint line-through decoration-[color-mix(in_srgb,var(--faint)_55%,transparent)]"
              : "text-ink",
          )}
        />
      </div>

      {showMeta ? (
        <div className="flex flex-wrap items-center gap-1 pl-[25px] text-[10.5px]">
          {done ? (
            <span className="rounded bg-[color-mix(in_srgb,var(--success)_13%,transparent)] px-1.5 py-px font-medium text-success">
              Done · {formatTimeOfDay(card.updatedAt)}
            </span>
          ) : null}
          {priority !== "none" ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-px font-medium",
                priority === "high"
                  ? "bg-[color-mix(in_srgb,var(--danger)_13%,transparent)] text-danger"
                  : "bg-surface-3 text-muted",
              )}
            >
              <Flag size={9} aria-hidden />
              {priority === "high" ? "High priority" : "Low priority"}
            </span>
          ) : null}
          {dueAt > 0 ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-px font-medium",
                overdue ? "bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-warning" : "bg-surface-3 text-muted",
              )}
            >
              <Calendar size={9} aria-hidden />
              {formatDay(dueAt)}
              {overdue ? " · overdue" : ""}
              <button
                type="button"
                data-no-drag
                aria-label="Clear due date"
                onClick={() => store.updateCard(card.id, { data: { dueAt: 0 } })}
                className="ml-0.5 rounded transition-colors hover:text-ink"
              >
                <X size={9} aria-hidden />
              </button>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
