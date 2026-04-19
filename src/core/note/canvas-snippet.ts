import {
  buildImageUrl,
  type IIIFImageApiVersion,
} from "../iiif/image-api.ts";
import type { IIIFCanvas } from "../iiif/types.ts";

export interface CanvasSnippetOptions {
  /**
   * Width (px) baked into the Image API URL. If the canvas has no
   * image service declared, we fall back to its `imageUrl` or
   * `thumbnail` verbatim and this option is ignored.
   */
  insertWidth: number;
  apiVersion: IIIFImageApiVersion;
  /**
   * Caption placed inside the `[]`. Leave undefined to use the
   * canvas label.
   */
  caption?: string;
}

/**
 * Assemble a Markdown image embed for an entire canvas. Prefers the
 * IIIF Image API (so the user can change the displayed size just by
 * editing the URL width); otherwise falls back to the canvas's raw
 * image URL or thumbnail.
 */
export function buildCanvasSnippet(
  canvas: IIIFCanvas,
  opts: CanvasSnippetOptions,
): string {
  const url = pickUrl(canvas, opts);
  if (!url) {
    throw new Error(`canvas "${canvas.label}" exposes neither an Image API service nor a static image URL`);
  }
  const caption = sanitize(opts.caption ?? canvas.label);
  return `![${caption}](${url})`;
}

/**
 * Assemble a batch of canvas snippets as a single Markdown block, each
 * separated by a blank line so each image renders standalone.
 */
export function buildCanvasBatch(
  canvases: IIIFCanvas[],
  opts: CanvasSnippetOptions,
): string {
  return canvases.map((c) => buildCanvasSnippet(c, opts)).join("\n\n");
}

function pickUrl(canvas: IIIFCanvas, opts: CanvasSnippetOptions): string | undefined {
  if (canvas.imageService?.id) {
    return buildImageUrl({
      service: canvas.imageService.id,
      size: { kind: "width", w: opts.insertWidth },
      apiVersion: opts.apiVersion,
    });
  }
  return canvas.imageUrl ?? canvas.thumbnail;
}

function sanitize(s: string): string {
  return s.replace(/[\r\n]+/g, " ");
}
