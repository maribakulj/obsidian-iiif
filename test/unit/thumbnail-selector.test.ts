import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickHeaderThumbnailUrl } from "../../src/core/note/thumbnail-selector.ts";
import type { IIIFManifest } from "../../src/core/iiif/types.ts";

function manifest(over: Partial<IIIFManifest> = {}): IIIFManifest {
  return {
    id: "https://example.org/m",
    version: "3",
    label: "x",
    metadata: [],
    canvases: [],
    rendering: [],
    seeAlso: [],
    raw: null,
    ...over,
  };
}

describe("pickHeaderThumbnailUrl", () => {
  it("prefers the top-level thumbnail when declared", () => {
    const m = manifest({ thumbnail: "https://example.org/thumb.jpg" });
    assert.equal(pickHeaderThumbnailUrl(m, 400), "https://example.org/thumb.jpg");
  });

  it("falls back to the first canvas Image API service at the requested width", () => {
    const m = manifest({
      canvases: [
        {
          id: "c1",
          label: "f. 1r",
          width: 1000,
          height: 1000,
          imageService: { id: "https://example.org/iiif/3/abc" },
          seeAlso: [],
        },
      ],
    });
    assert.equal(
      pickHeaderThumbnailUrl(m, 300),
      "https://example.org/iiif/3/abc/full/300,/0/default.jpg",
    );
  });

  it("returns undefined when nothing is available", () => {
    assert.equal(pickHeaderThumbnailUrl(manifest(), 400), undefined);
  });
});
