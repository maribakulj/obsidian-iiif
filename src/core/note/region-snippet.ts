import {
  buildImageUrl,
  type IIIFImageApiVersion,
} from "../iiif/image-api.ts";
import type { Rect } from "../iiif/region-math.ts";

export interface RegionSnippetOptions {
  /** IIIF Image API base URL for the canvas (no trailing slash). */
  service: string;
  /** Region in source (original canvas) pixel coordinates. */
  source: Rect;
  /**
   * Width (px) to request from the server for the embedded image. The
   * server preserves aspect ratio, so height is implicit.
   */
  displayWidth: number;
  /** IIIF Image API version — affects size-param serialization. */
  apiVersion: IIIFImageApiVersion;
  /** Optional Markdown caption placed inside the `[]`. */
  caption?: string;
}

/**
 * Assemble a Markdown image embed pointing at a IIIF Image API URL that
 * crops a specific region and scales it to `displayWidth`.
 */
export function buildRegionSnippet(opts: RegionSnippetOptions): string {
  const url = buildImageUrl({
    service: opts.service,
    region: { kind: "absolute", ...opts.source },
    size: { kind: "width", w: opts.displayWidth },
    apiVersion: opts.apiVersion,
  });
  const caption = (opts.caption ?? "").replace(/[\r\n]+/g, " ");
  return `![${caption}](${url})`;
}
