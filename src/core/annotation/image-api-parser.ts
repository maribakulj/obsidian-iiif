/**
 * Inverse of `core/iiif/image-api.ts` — given a fully-formed IIIF
 * Image API URL, recover its components. Used to translate Markdown
 * image embeds inserted by the plugin into structured data so we can
 * emit Web Annotations with proper `xywh=` fragment selectors.
 *
 * Returns null when the URL doesn't match the canonical
 *   {service}/{region}/{size}/{rotation}/{quality}.{format}
 * shape — region URLs the user typed by hand, thumbnails from a
 * `thumbnail` field, etc.
 */

const REGION_RE =
  /^(full|square|\d+,\d+,\d+,\d+|pct:\d+(?:\.\d+)?,\d+(?:\.\d+)?,\d+(?:\.\d+)?,\d+(?:\.\d+)?)$/;
const SIZE_RE =
  /^\^?(max|full|\d+,?|,\d+|\d+,\d+|!\d+,\d+|pct:\d+(?:\.\d+)?)$/;
const ROTATION_RE = /^!?\d+(?:\.\d+)?$/;
const QUALITY_RE = /^(default|color|gray|bitonal)$/;

export interface ImageApiParts {
  service: string;
  region: string;
  size: string;
  rotation: string;
  quality: string;
  format: string;
}

export interface ParsedRegion {
  kind: "full" | "square" | "absolute" | "percent";
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export function parseImageApiUrl(url: string): ImageApiParts | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 4) return null;

  const qualityFormat = segments[segments.length - 1]!;
  const rotation = segments[segments.length - 2]!;
  const size = segments[segments.length - 3]!;
  const region = segments[segments.length - 4]!;
  const dot = qualityFormat.lastIndexOf(".");
  if (dot <= 0) return null;
  const quality = qualityFormat.slice(0, dot);
  const format = qualityFormat.slice(dot + 1);

  if (!REGION_RE.test(region)) return null;
  if (!SIZE_RE.test(size)) return null;
  if (!ROTATION_RE.test(rotation)) return null;
  if (!QUALITY_RE.test(quality)) return null;
  if (!/^[a-z0-9]+$/i.test(format)) return null;

  const baseSegments = segments.slice(0, segments.length - 4);
  const basePath = baseSegments.length > 0 ? "/" + baseSegments.join("/") : "";
  const service = `${parsed.origin}${basePath}`;

  return { service, region, size, rotation, quality, format };
}

/** Decode a region segment back into a structured shape. */
export function parseRegion(segment: string): ParsedRegion | null {
  if (segment === "full") return { kind: "full" };
  if (segment === "square") return { kind: "square" };
  if (segment.startsWith("pct:")) {
    const parts = segment.slice(4).split(",").map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
    return { kind: "percent", x: parts[0]!, y: parts[1]!, w: parts[2]!, h: parts[3]! };
  }
  const parts = segment.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return null;
  return { kind: "absolute", x: parts[0]!, y: parts[1]!, w: parts[2]!, h: parts[3]! };
}

/**
 * Render a parsed absolute region as a Media Fragments `xywh=` value
 * suitable for a Web Annotation FragmentSelector. Returns null for
 * `full`, `square`, or `percent` regions — those don't map cleanly
 * onto Media Fragments without the original canvas dimensions.
 */
export function regionToXywh(region: ParsedRegion): string | null {
  if (region.kind !== "absolute") return null;
  return `xywh=${region.x},${region.y},${region.w},${region.h}`;
}
