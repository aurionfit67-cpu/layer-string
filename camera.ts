import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  clamp,
  screenToWorld,
  unionRects,
  type Point,
  type Rect,
  type Viewport,
} from "@/lib/types/layout";

export const ZOOM_STEPS = [0.25, 0.4, 0.55, 0.7, 0.85, 1, 1.2, 1.45, 1.75, 2.1, 2.5];

const DEFAULT_BOUNDS = { width: 1280, height: 800 };

/**
 * The camera owns the one piece of workspace state that changes 60 times a
 * second: where the viewport is.
 *
 * It is deliberately *not* React state. Components subscribe to it, and the
 * canvas layer is moved with a single imperative transform write, so panning
 * and zooming never re-render the cards. That is what keeps the workspace
 * smooth while still letting the toolbar show a live zoom percentage.
 */
export class Camera {
  private viewport: Viewport;
  private bounds = { ...DEFAULT_BOUNDS };
  private listeners = new Set<() => void>();
  private element: HTMLElement | null = null;
  private frame: number | null = null;
  private animated = false;

  private inkVar = "--card-ink";
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private field: HTMLElement | null = null;
  private grid = 24;
  private revision = 0;

  /** Bumped on every committed viewport change so React can subscribe cheaply. */
  get tick(): number {
    return this.revision;
  }

  constructor(initial?: Partial<Viewport>) {
    this.viewport = {
      x: initial?.x ?? 0,
      y: initial?.y ?? 0,
      scale: clamp(initial?.scale ?? DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM),
    };
  }

  getViewport(): Viewport {
    return this.viewport;
  }

  getBounds(): { width: number; height: number } {
    return this.bounds;
  }

  setBounds(width: number, height: number): void {
    if (width > 0 && height > 0) this.bounds = { width, height };
  }

  /**
   * Binding the world element lets the camera write `transform` directly.
   * `inkVar` is the CSS custom property the cards use to keep their type size
   * readable when zoomed far out.
   */
  /**
   * `field` is the canvas element behind the world: the camera paints the dot
   * grid onto it, so panning never re-renders anything.
   */
  bind(element: HTMLElement | null, field?: HTMLElement | null, inkVar = "--card-ink"): void {
    this.element = element;
    this.field = field ?? null;
    this.inkVar = inkVar;
    this.paint();
  }

  setGrid(size: number): void {
    if (size === this.grid) return;
    this.grid = size;
    this.paint();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private paint(): void {
    const { x, y, scale } = this.viewport;
    const element = this.element;
    if (element) {
      element.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
      // Type shrinks more slowly than geometry (1 at 100%, ~0.56 at 25%) so a
      // zoomed-out Layer reads as a map instead of noise.
      const ink = Math.min(1, Math.pow(scale, 0.42));
      element.style.setProperty(this.inkVar, String(Number(ink.toFixed(3))));
      element.style.transition = this.animated
        ? "transform 240ms cubic-bezier(0.22, 0.61, 0.36, 1)"
        : "none";
    }
    if (this.field) {
      const gap = this.grid * scale;
      this.field.style.setProperty("--dot-gap", `${gap}px`);
      this.field.style.setProperty("--dot-x", `${x}px`);
      this.field.style.setProperty("--dot-y", `${y}px`);
      // Dots fade out as you zoom in so the field never competes with content.
      this.field.style.setProperty("--dot-opacity", String(scale < 0.5 ? 0.5 : 1));
    }
    this.revision += 1;
    this.emit();
  }

  private commit(next: Viewport, options?: { animate?: boolean }): void {
    this.animated = options?.animate === true;
    if (this.animated) this.autoSettle();
    this.viewport = {
      x: Number.isFinite(next.x) ? next.x : 0,
      y: Number.isFinite(next.y) ? next.y : 0,
      scale: clamp(next.scale, MIN_ZOOM, MAX_ZOOM),
    };
    this.paint();
  }

  setViewport(viewport: Viewport, options?: { animate?: boolean }): void {
    this.commit(viewport, options);
  }

  panBy(dx: number, dy: number): void {
    this.commit({ ...this.viewport, x: this.viewport.x + dx, y: this.viewport.y + dy });
  }

  /** Zoom while keeping `anchor` (client px relative to the canvas) fixed. */
  zoomTo(scale: number, anchor?: Point, options?: { animate?: boolean }): void {
    const next = clamp(scale, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(next - this.viewport.scale) < 0.0001) return;
    if (!anchor) {
      anchor = { x: this.bounds.width / 2, y: this.bounds.height / 2 };
    }
    const world = screenToWorld(anchor, this.viewport);
    this.commit(
      {
        x: anchor.x - world.x * next,
        y: anchor.y - world.y * next,
        scale: next,
      },
      options,
    );
  }

  zoomBy(factor: number, anchor?: Point): void {
    this.zoomTo(this.viewport.scale * factor, anchor, { animate: true });
  }

  /** Step through ZOOM_STEPS so keyboard zoom lands on tidy values. */
  zoomStep(direction: 1 | -1, anchor?: Point): void {
    const current = this.viewport.scale;
    if (direction > 0) {
      const next = ZOOM_STEPS.find((step) => step > current + 0.001);
      this.zoomTo(next ?? MAX_ZOOM, anchor, { animate: true });
      return;
    }
    const below = [...ZOOM_STEPS].reverse().find((step) => step < current - 0.001);
    this.zoomTo(below ?? MIN_ZOOM, anchor, { animate: true });
  }

  resetZoom(): void {
    this.zoomTo(DEFAULT_ZOOM, undefined, { animate: true });
  }

  /** Centre a world point without changing zoom. */
  centerOn(point: Point, options?: { animate?: boolean }): void {
    const { scale } = this.viewport;
    this.commit(
      {
        x: this.bounds.width / 2 - point.x * scale,
        y: this.bounds.height / 2 - point.y * scale,
        scale,
      },
      options,
    );
  }

  /**
   * Frame the given world rects. Returns the viewport it chose so callers can
   * persist it. `maxScale` keeps a small Layer from becoming comically huge.
   */
  fitTo(rects: Rect[], options?: { padding?: number; maxScale?: number }): Viewport {
    const box = unionRects(rects);
    if (!box) {
      const centered = { x: 0, y: 0, scale: DEFAULT_ZOOM };
      this.commit(centered, { animate: true });
      return this.viewport;
    }
    const padding = options?.padding ?? 96;
    const maxScale = options?.maxScale ?? 1.15;
    const available = {
      width: Math.max(240, this.bounds.width - padding * 2),
      height: Math.max(240, this.bounds.height - padding * 2),
    };
    const scale = clamp(
      Math.min(available.width / Math.max(1, box.width), available.height / Math.max(1, box.height)),
      MIN_ZOOM,
      maxScale,
    );
    this.commit(
      {
        x: this.bounds.width / 2 - (box.x + box.width / 2) * scale,
        y: this.bounds.height / 2 - (box.y + box.height / 2) * scale,
        scale,
      },
      { animate: true },
    );
    return this.viewport;
  }

  schedule(frame: () => void): void {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      frame();
    });
  }

  cancel(): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  /** Drop the transition after a programmatic move so gestures stay instant. */
  settle(): void {
    if (this.settleTimer) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
    this.animated = false;
    if (this.element) this.element.style.transition = "none";
  }

  /** Queue the transition teardown for an animation of the given length. */
  autoSettle(ms = 280): void {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.animated = false;
      if (this.element) this.element.style.transition = "none";
    }, ms);
  }

  destroy(): void {
    this.cancel();
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.listeners.clear();
    this.element = null;
  }
}
