/**
 * IIIF Image API URL builder.
 *
 * Assembles URLs of the form:
 *   {base}/{region}/{size}/{rotation}/{quality}.{format}
 *
 * Covers the request-syntax sections of the Image API 2.1 and 3.0 specs.
 * Validates params before interpolation — a bad region or size throws
 * rather than producing a silently broken URL.
 */

export type IIIFImageApiVersion = "2" | "3";

export type IIIFQuality = "default" | "color" | "gray" | "bitonal";

export type IIIFFormat = "jpg" | "png" | "webp" | "tif" | "gif" | "jp2" | "pdf";

/** `full`, `square`, absolute pixels, or percentage of source. */
export type IIIFRegion =
  | { kind: "full" }
  | { kind: "square" }
  | { kind: "absolute"; x: number; y: number; w: number; h: number }
  | { kind: "percent"; x: number; y: number; w: number; h: number };

/**
 * Size parameter, per Image API:
 *   - `max`: largest the server will return (both versions)
 *   - `full`: original size (v2 only; v3 uses `max`)
 *   - `width`: `w,` — scale to width, preserve aspect
 *   - `height`: `,h` — scale to height, preserve aspect
 *   - `exact`: `w,h` — exact, may distort
 *   - `bestFit`: `!w,h` — fit within box, preserve aspect
 *   - `percent`: `pct:n`
 *
 * `upscale: true` prepends `^` (v3 only; spec §4.2).
 */
export type IIIFSize =
  | { kind: "max"; upscale?: boolean }
  | { kind: "full" }
  | { kind: "width"; w: number; upscale?: boolean }
  | { kind: "height"; h: number; upscale?: boolean }
  | { kind: "exact"; w: number; h: number; upscale?: boolean }
  | { kind: "bestFit"; w: number; h: number; upscale?: boolean }
  | { kind: "percent"; pct: number; upscale?: boolean };

export interface BuildImageUrlOptions {
  /** Image API base URL, e.g. `https://host/iiif/2/abc123` (no trailing slash). */
  service: string;
  region?: IIIFRegion;
  size?: IIIFSize;
  /** Rotation in degrees `[0, 360]`. */
  rotation?: number;
  /** Mirror (flip horizontally) before rotation. v2.1+ / v3. */
  mirror?: boolean;
  quality?: IIIFQuality;
  format?: IIIFFormat;
  /** Affects `size` serialization (`full` vs `max`, `^` prefix). */
  apiVersion?: IIIFImageApiVersion;
}

export function buildImageUrl(opts: BuildImageUrlOptions): string {
  const apiVersion = opts.apiVersion ?? "3";
  const base = trimTrailingSlash(opts.service);
  if (!base) throw new Error("buildImageUrl: service base URL is required");

  const region = formatRegion(opts.region ?? { kind: "full" });
  const size = formatSize(opts.size ?? { kind: "max" }, apiVersion);
  const rotation = formatRotation(opts.rotation ?? 0, opts.mirror ?? false);
  const quality = opts.quality ?? "default";
  const format = opts.format ?? "jpg";

  return `${base}/${region}/${size}/${rotation}/${quality}.${format}`;
}

/** Convenience: a thumbnail scaled to a given width, full region. */
export function buildThumbnailUrl(service: string, width: number, apiVersion: IIIFImageApiVersion = "3"): string {
  return buildImageUrl({
    service,
    region: { kind: "full" },
    size: { kind: "width", w: width },
    apiVersion,
  });
}

/** Convenience: a region cropped from the source, scaled to `displayWidth`. */
export function buildRegionUrl(
  service: string,
  region: { x: number; y: number; w: number; h: number },
  displayWidth?: number,
  apiVersion: IIIFImageApiVersion = "3",
): string {
  return buildImageUrl({
    service,
    region: { kind: "absolute", ...region },
    size: displayWidth != null ? { kind: "width", w: displayWidth } : { kind: "max" },
    apiVersion,
  });
}

function formatRegion(region: IIIFRegion): string {
  switch (region.kind) {
    case "full":
      return "full";
    case "square":
      return "square";
    case "absolute": {
      assertNonNegInt("region.x", region.x);
      assertNonNegInt("region.y", region.y);
      assertPosInt("region.w", region.w);
      assertPosInt("region.h", region.h);
      return `${region.x},${region.y},${region.w},${region.h}`;
    }
    case "percent": {
      assertPercent("region.x", region.x);
      assertPercent("region.y", region.y);
      assertPercent("region.w", region.w, { allowZero: false });
      assertPercent("region.h", region.h, { allowZero: false });
      return `pct:${fmtNum(region.x)},${fmtNum(region.y)},${fmtNum(region.w)},${fmtNum(region.h)}`;
    }
  }
}

function formatSize(size: IIIFSize, apiVersion: IIIFImageApiVersion): string {
  const upPrefix = (s: { upscale?: boolean }): string => {
    if (!s.upscale) return "";
    if (apiVersion !== "3") {
      throw new Error("size.upscale (^) is only allowed in Image API v3");
    }
    return "^";
  };

  switch (size.kind) {
    case "max":
      return `${upPrefix(size)}max`;
    case "full":
      if (apiVersion === "3") {
        throw new Error("size 'full' is v2 only; use 'max' in v3");
      }
      return "full";
    case "width":
      assertPosInt("size.w", size.w);
      return `${upPrefix(size)}${size.w},`;
    case "height":
      assertPosInt("size.h", size.h);
      return `${upPrefix(size)},${size.h}`;
    case "exact":
      assertPosInt("size.w", size.w);
      assertPosInt("size.h", size.h);
      return `${upPrefix(size)}${size.w},${size.h}`;
    case "bestFit":
      assertPosInt("size.w", size.w);
      assertPosInt("size.h", size.h);
      return `${upPrefix(size)}!${size.w},${size.h}`;
    case "percent":
      assertPositive("size.pct", size.pct);
      return `${upPrefix(size)}pct:${fmtNum(size.pct)}`;
  }
}

function formatRotation(deg: number, mirror: boolean): string {
  if (!Number.isFinite(deg) || deg < 0 || deg > 360) {
    throw new Error(`rotation must be within [0, 360], got ${deg}`);
  }
  return `${mirror ? "!" : ""}${fmtNum(deg)}`;
}

function trimTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

function assertNonNegInt(name: string, v: number): void {
  if (!Number.isInteger(v) || v < 0) {
    throw new Error(`${name} must be a non-negative integer, got ${v}`);
  }
}

function assertPosInt(name: string, v: number): void {
  if (!Number.isInteger(v) || v <= 0) {
    throw new Error(`${name} must be a positive integer, got ${v}`);
  }
}

function assertPositive(name: string, v: number): void {
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error(`${name} must be positive, got ${v}`);
  }
}

function assertPercent(name: string, v: number, opts: { allowZero?: boolean } = {}): void {
  const allowZero = opts.allowZero ?? true;
  if (!Number.isFinite(v) || v < 0 || v > 100 || (!allowZero && v === 0)) {
    throw new Error(`${name} must be in ${allowZero ? "[0, 100]" : "(0, 100]"}, got ${v}`);
  }
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(6)));
}
