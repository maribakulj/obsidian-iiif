import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collectTranscripts,
  detectTranscriptFormat,
} from "../../src/core/transcripts/detect.ts";
import type { IIIFManifest, IIIFResource } from "../../src/core/iiif/types.ts";

function resource(over: Partial<IIIFResource> = {}): IIIFResource {
  return { id: "https://example.org/x", ...over };
}

describe("detectTranscriptFormat", () => {
  it("detects ALTO from profile", () => {
    assert.equal(
      detectTranscriptFormat(
        resource({
          id: "https://example.org/x.xml",
          format: "application/xml",
          profile: "http://www.loc.gov/standards/alto/ns-v3#",
        }),
      ),
      "alto",
    );
  });

  it("detects ALTO from URL", () => {
    assert.equal(
      detectTranscriptFormat(
        resource({
          id: "https://example.org/page1-alto.xml",
          format: "application/xml",
        }),
      ),
      "alto",
    );
  });

  it("detects hOCR from .hocr extension", () => {
    assert.equal(
      detectTranscriptFormat(resource({ id: "https://example.org/page.hocr" })),
      "hocr",
    );
  });

  it("detects hOCR from dedicated MIME type", () => {
    assert.equal(
      detectTranscriptFormat(
        resource({ id: "https://example.org/x", format: "application/vnd.hocr+html" }),
      ),
      "hocr",
    );
  });

  it("detects plain text", () => {
    assert.equal(
      detectTranscriptFormat(resource({ format: "text/plain" })),
      "plain",
    );
    assert.equal(
      detectTranscriptFormat(resource({ id: "https://example.org/transcription.txt" })),
      "plain",
    );
  });

  it("returns unknown for generic XML with no alto marker", () => {
    assert.equal(
      detectTranscriptFormat(resource({ format: "application/xml" })),
      "unknown",
    );
  });

  it("returns unknown for unrelated resources", () => {
    assert.equal(
      detectTranscriptFormat(resource({ format: "application/pdf" })),
      "unknown",
    );
  });
});

describe("collectTranscripts", () => {
  const manifest: IIIFManifest = {
    id: "https://example.org/m",
    version: "3",
    label: "M",
    metadata: [],
    canvases: [
      {
        id: "https://example.org/c/1",
        label: "f. 1r",
        width: 10,
        height: 10,
        seeAlso: [
          resource({
            id: "https://example.org/c/1/alto.xml",
            format: "application/xml",
            profile: "http://www.loc.gov/standards/alto/",
          }),
        ],
      },
      {
        id: "https://example.org/c/2",
        label: "f. 1v",
        width: 10,
        height: 10,
        seeAlso: [],
      },
    ],
    rendering: [],
    seeAlso: [
      resource({ id: "https://example.org/m/text.txt", format: "text/plain" }),
      resource({ id: "https://example.org/m/other.pdf", format: "application/pdf" }),
    ],
    raw: null,
  };

  it("enumerates manifest-level first then per-canvas entries", () => {
    const out = collectTranscripts(manifest);
    assert.equal(out.length, 3);
    assert.equal(out[0]!.scope.kind, "manifest");
    assert.equal(out[0]!.format, "plain");
    assert.equal(out[1]!.scope.kind, "manifest");
    assert.equal(out[1]!.format, "unknown"); // keep unknown so UI can surface it
    assert.equal(out[2]!.scope.kind, "canvas");
  });

  it("attaches canvas context to per-canvas entries", () => {
    const out = collectTranscripts(manifest);
    const perCanvas = out.find((t) => t.scope.kind === "canvas");
    assert.ok(perCanvas);
    if (perCanvas.scope.kind !== "canvas") throw new Error();
    assert.equal(perCanvas.scope.canvasIndex, 0);
    assert.equal(perCanvas.scope.canvasLabel, "f. 1r");
    assert.equal(perCanvas.format, "alto");
  });
});
