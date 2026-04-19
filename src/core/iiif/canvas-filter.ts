import type { IIIFCanvas } from "./types.ts";

/**
 * Case-insensitive, diacritic-insensitive substring match on
 * canvas.label. An empty query returns the input unchanged.
 */
export function filterCanvases(canvases: IIIFCanvas[], query: string): IIIFCanvas[] {
  const q = normalize(query);
  if (q.length === 0) return canvases;
  return canvases.filter((c) => normalize(c.label).includes(q));
}

export interface Page<T> {
  items: T[];
  page: number;       // 1-based
  pageSize: number;
  totalPages: number;
  total: number;
}

export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  if (pageSize <= 0) throw new Error("pageSize must be positive");
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.max(1, Math.min(totalPages, Math.trunc(page)));
  const start = (clampedPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: clampedPage,
    pageSize,
    totalPages,
    total,
  };
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
