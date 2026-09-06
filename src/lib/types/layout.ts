/** Spatial primitives shared by cards and the workspace camera. */

export type CardPosition = {
  x: number;
  y: number;
  /** Preferred width in world units. Height is driven by content. */
  width?: number;
  /** Optional fixed height; when omitted the card sizes to its content. */
  height?: number;
  /** Render order within the Layer. */
  z?: number;
};

export type Point = { x: number; y: number };

export type Size = { width: number; height: number };

export type Rect = { x: number; y: number; width: number; height: number };

export type Viewport = {
  /** Horizontal offset of the world origin, in screen pixels. */
  x: number;
  /** Vertical offset of the world origin, in screen pixels. */
  y: number;
  scale: number;
};

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;
export const DEFAULT_ZOOM = 1;
export const GRID_SIZE = 24;
export const CARD_DEFAULT_WIDTH = 320;
export const CARD_MIN_WIDTH = 220;
export const CARD_MAX_WIDTH = 640;

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function snapToGrid(value: number, size: number): number {
  if (!Number.isFinite(value) || size <= 0) return value;
  return Math.round(value / size) * size;
}

/** Convert a world point to screen pixels for the given viewport. */
export function worldToScreen(point: Point, viewport: Viewport): Point {
  return {
    x: point.x * viewport.scale + viewport.x,
    y: point.y * viewport.scale + viewport.y,
  };
}

/** Convert screen pixels (relative to the canvas element) to world space. */
export function screenToWorld(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.x) / viewport.scale,
    y: (point.y - viewport.y) / viewport.scale,
  };
}

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxY)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
