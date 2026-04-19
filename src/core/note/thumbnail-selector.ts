import { buildThumbnailUrl } from "../iiif/image-api.ts";
import type { IIIFManifest } from "../iiif/types.ts";

/**
 * Pick a header thumbnail URL for a manifest. Prefers the top-level
 * declared `thumbnail`; otherwise derives one from the first canvas's
 * Image API service at the requested width.
 *
 * Shared by the note builder, the snapshot writer, and the refresh
 * command so they always agree on which URL represents "the" header
 * thumbnail.
 */
export function pickHeaderThumbnailUrl(
  manifest: IIIFManifest,
  width: number,
): string | undefined {
  if (manifest.thumbnail) return manifest.thumbnail;
  const firstCanvasService = manifest.canvases[0]?.imageService?.id;
  if (firstCanvasService) {
    return buildThumbnailUrl(
      firstCanvasService,
      width,
      manifest.version === "2" ? "2" : "3",
    );
  }
  return undefined;
}
