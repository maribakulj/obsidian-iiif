import type { IIIFManifest, IIIFResource } from "../iiif/types.ts";
import type { TranscriptFormat, TranscriptSource } from "./types.ts";

/**
 * Detect the transcript format of a IIIF resource from its `format`,
 * `profile`, and URL. Ordered from most to least specific; returns
 * "unknown" when no heuristic fires.
 */
export function detectTranscriptFormat(resource: IIIFResource): TranscriptFormat {
  const format = (resource.format ?? "").toLowerCase();
  const profile = (resource.profile ?? "").toLowerCase();
  const url = resource.id.toLowerCase();

  if (profile.includes("alto") || url.includes("alto")) return "alto";
  if (profile.includes("hocr") || url.endsWith(".hocr")) return "hocr";

  if (format === "application/alto+xml") return "alto";
  if (format === "application/vnd.hocr+html") return "hocr";

  if (format === "text/html" && (profile.includes("ocr") || url.includes("hocr"))) return "hocr";
  if (format === "application/xml" || format === "text/xml") {
    return profile.includes("alto") || url.includes("alto") ? "alto" : "unknown";
  }
  if (format === "text/plain") return "plain";

  if (url.endsWith(".txt")) return "plain";
  if (url.endsWith(".xml") && url.includes("alto")) return "alto";

  return "unknown";
}

/**
 * Walk a manifest and collect every transcript candidate found in
 * manifest-level and per-canvas `seeAlso` arrays. Results appear in
 * manifest declaration order (manifest-level first, then canvases in
 * order). Resources of unknown format are still returned so the UI
 * can surface them to the user.
 */
export function collectTranscripts(manifest: IIIFManifest): TranscriptSource[] {
  const out: TranscriptSource[] = [];
  for (const r of manifest.seeAlso) {
    out.push({
      resource: r,
      format: detectTranscriptFormat(r),
      scope: { kind: "manifest" },
    });
  }
  for (const [i, canvas] of manifest.canvases.entries()) {
    for (const r of canvas.seeAlso) {
      out.push({
        resource: r,
        format: detectTranscriptFormat(r),
        scope: {
          kind: "canvas",
          canvasId: canvas.id,
          canvasLabel: canvas.label,
          canvasIndex: i,
        },
      });
    }
  }
  return out;
}
