"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "./button";
import { Trash } from "lucide-react";

type Props = {
  children: ReactNode;
  /** Shown instead of the default inline failure. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  label: string;
  /** Called when the user asks to discard the broken thing (e.g. delete card). */
  onDiscard?: () => void;
  resetKeys?: unknown[];
};

type State = { error: Error | null };

/**
 * One malformed card must never take down a Layer. Each card is wrapped, so the
 * failure surface is exactly the thing that broke, and the user gets a real way
 * out (retry the render, or delete the record).
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[layer] ${this.props.label} failed to render`, error, info.componentStack);
    }
  }

  override componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKeys !== this.props.resetKeys) {
      this.setState({ error: null });
    }
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="card-plate flex flex-col gap-2 p-3.5" role="alert">
        <p className="text-[13px] font-semibold text-ink">This card could not be read</p>
        <p className="text-[11px] leading-snug text-muted">{error.message || "Unknown render error."}</p>
        <div className="flex gap-2 pt-0.5">
          <Button size="sm" onClick={this.reset}>
            Try again
          </Button>
          {this.props.onDiscard ? (
            <Button size="sm" variant="danger" onClick={this.props.onDiscard}>
              <Trash />
              Delete card
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
}
