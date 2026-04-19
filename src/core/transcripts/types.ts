import type { IIIFResource } from "../iiif/types.ts";

export type TranscriptFormat = "alto" | "hocr" | "plain" | "unknown";

/**
 * A transcript candidate discovered by walking a manifest's `seeAlso`
 * entries (at both the manifest and canvas level). `scope` identifies
 * where the transcript was declared — useful for the picker UI.
 */
export interface TranscriptSource {
  /** Original IIIF resource. */
  resource: IIIFResource;
  /** Detected format. `unknown` entries are skipped by the fetcher. */
  format: TranscriptFormat;
  /** Where in the manifest tree this was declared. */
  scope:
    | { kind: "manifest" }
    | { kind: "canvas"; canvasId: string; canvasLabel: string; canvasIndex: number };
}

/** Result of a successful fetch + conversion. */
export interface TranscriptText {
  source: TranscriptSource;
  text: string;
}
