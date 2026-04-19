import type { IIIFManifest } from "../iiif/types.ts";
import type { ExtractedEmbed } from "./extract.ts";
import { regionToXywh } from "./image-api-parser.ts";
import {
  WEB_ANNOTATION_CONTEXT,
  type AnnotationPage,
  type AnnotationTarget,
  type WebAnnotation,
} from "./types.ts";

export interface BuildOptions {
  manifestUrl: string;
  /** Optional Annotation `creator` field (URI or display name). */
  creator?: string;
  /** Timestamp used for the page id and `created` field. */
  now?: Date;
  /** Override for `crypto.randomUUID()` — handy in tests. */
  uuid?: () => string;
}

export interface BuildResult {
  page: AnnotationPage;
  /** Number of embeds in the note that couldn't be matched to a canvas. */
  unmatched: number;
}

/**
 * Build a `AnnotationPage` from a list of extracted IIIF embeds plus
 * the parsed manifest those embeds belong to.
 *
 * Embeds whose Image API service can't be matched to a canvas in the
 * supplied manifest are skipped (and counted, for the user's report).
 * `full` and `square` regions become canvas-scope annotations with
 * no `xywh=` fragment selector.
 */
export function buildAnnotationPage(
  embeds: ExtractedEmbed[],
  manifest: IIIFManifest,
  opts: BuildOptions,
): BuildResult {
  const now = opts.now ?? new Date();
  const uuid = opts.uuid ?? randomUuid;
  const items: WebAnnotation[] = [];
  let unmatched = 0;

  for (const e of embeds) {
    const canvas = manifest.canvases.find(
      (c) => c.imageService?.id === e.parts.service,
    );
    if (!canvas) {
      unmatched++;
      continue;
    }
    const target: AnnotationTarget = {
      type: "SpecificResource",
      source: canvas.id,
      partOf: { id: opts.manifestUrl, type: "Manifest" },
    };
    const xywh = regionToXywh(e.region);
    if (xywh) {
      target.selector = {
        type: "FragmentSelector",
        conformsTo: "http://www.w3.org/TR/media-frags/",
        value: xywh,
      };
    }

    const annotation: WebAnnotation = {
      "@context": WEB_ANNOTATION_CONTEXT,
      id: `urn:uuid:${uuid()}`,
      type: "Annotation",
      motivation: "commenting",
      created: now.toISOString(),
      body: {
        type: "TextualBody",
        value: e.caption,
        format: "text/plain",
      },
      target,
    };
    if (opts.creator && opts.creator.length > 0) annotation.creator = opts.creator;
    items.push(annotation);
  }

  const page: AnnotationPage = {
    "@context": WEB_ANNOTATION_CONTEXT,
    id: `urn:uuid:${uuid()}`,
    type: "AnnotationPage",
    partOf: { id: opts.manifestUrl, type: "Manifest" },
    items,
  };

  return { page, unmatched };
}

export function serializeAnnotationPage(page: AnnotationPage): string {
  return JSON.stringify(page, null, 2) + "\n";
}

function randomUuid(): string {
  // crypto.randomUUID() is available in Node 19+, browsers, and Electron.
  return (globalThis.crypto as Crypto).randomUUID();
}
