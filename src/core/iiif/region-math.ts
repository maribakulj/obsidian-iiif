/**
 * Pure math for the region picker.
 *
 * Converts between display-space rectangles (pixels on the rendered
 * thumbnail) and source-space rectangles (pixels of the original IIIF
 * canvas), and normalizes pointer drags into positive-dimension rects.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Dim {
  w: number;
  h: number;
}

/** Turn a drag (start point, current point) into a positive-w/h rect. */
export function normalizeDrag(start: Point, current: Point): Rect {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    w: Math.abs(current.x - start.x),
    h: Math.abs(current.y - start.y),
  };
}

/** Clamp a display-space rect so it stays inside the rendered thumbnail. */
export function clampRect(rect: Rect, bounds: Dim): Rect {
  const x = clamp(rect.x, 0, bounds.w);
  const y = clamp(rect.y, 0, bounds.h);
  const w = clamp(rect.w, 0, bounds.w - x);
  const h = clamp(rect.h, 0, bounds.h - y);
  return { x, y, w, h };
}

/**
 * Convert a display-space rect (CSS px on the rendered `<img>`) into the
 * source pixel coordinates of the original IIIF canvas. Clamps to the
 * source bounds and enforces `w >= 1`, `h >= 1` so the resulting URL is
 * always valid.
 */
export function displayToSource(display: Rect, displayDim: Dim, sourceDim: Dim): Rect {
  assertPositive("displayDim.w", displayDim.w);
  assertPositive("displayDim.h", displayDim.h);
  assertPositive("sourceDim.w", sourceDim.w);
  assertPositive("sourceDim.h", sourceDim.h);
  const scaleX = sourceDim.w / displayDim.w;
  const scaleY = sourceDim.h / displayDim.h;
  const x = clamp(Math.round(display.x * scaleX), 0, sourceDim.w - 1);
  const y = clamp(Math.round(display.y * scaleY), 0, sourceDim.h - 1);
  const rawW = Math.round(display.w * scaleX);
  const rawH = Math.round(display.h * scaleY);
  const w = clamp(rawW, 1, sourceDim.w - x);
  const h = clamp(rawH, 1, sourceDim.h - y);
  return { x, y, w, h };
}

/** Inverse of `displayToSource`, handy for drawing saved selections. */
export function sourceToDisplay(source: Rect, displayDim: Dim, sourceDim: Dim): Rect {
  assertPositive("sourceDim.w", sourceDim.w);
  assertPositive("sourceDim.h", sourceDim.h);
  const scaleX = displayDim.w / sourceDim.w;
  const scaleY = displayDim.h / sourceDim.h;
  return {
    x: source.x * scaleX,
    y: source.y * scaleY,
    w: source.w * scaleX,
    h: source.h * scaleY,
  };
}

/** True when a rect is too small to bother inserting. */
export function rectIsTrivial(rect: Rect, minPx = 3): boolean {
  return rect.w < minPx || rect.h < minPx;
}

function clamp(v: number, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function assertPositive(name: string, v: number): void {
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error(`${name} must be positive, got ${v}`);
  }
}
