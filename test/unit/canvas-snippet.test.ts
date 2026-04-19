import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCanvasBatch,
  buildCanvasSnippet,
} from "../../src/core/note/canvas-snippet.ts";
import type { IIIFCanvas } from "../../src/core/iiif/types.ts";

function fakeCanvas(over: Partial<IIIFCanvas> = {}): IIIFCanvas {
  return {
    id: "https://example.org/canvas/1",
    label: "f. 1r",
    width: 3000,
    height: 4000,
    imageService: { id: "https://example.org/iiif/3/abc" },
    seeAlso: [],
    ...over,
  };
}

describe("buildCanvasSnippet", () => {
  it("uses the Image API width URL when a service is available", () => {
    const s = buildCanvasSnippet(fakeCanvas(), {
      insertWidth: 800,
      apiVersion: "3",
    });
    assert.equal(
      s,
      "![f. 1r](https://example.org/iiif/3/abc/full/800,/0/default.jpg)",
    );
  });

  it("uses the canvas label as default caption", () => {
    const s = buildCanvasSnippet(fakeCanvas({ label: "miniature" }), {
      insertWidth: 400,
      apiVersion: "3",
    });
    assert.ok(s.startsWith("![miniature]"));
  });

  it("overrides caption when provided", () => {
    const s = buildCanvasSnippet(fakeCanvas(), {
      insertWidth: 400,
      apiVersion: "3",
      caption: "custom",
    });
    assert.ok(s.startsWith("![custom]"));
  });

  it("falls back to imageUrl when no service is declared", () => {
    const s = buildCanvasSnippet(
      fakeCanvas({ imageService: undefined, imageUrl: "https://example.org/static.jpg" }),
      { insertWidth: 400, apiVersion: "3" },
    );
    assert.equal(s, "![f. 1r](https://example.org/static.jpg)");
  });

  it("falls back to thumbnail if no service and no imageUrl", () => {
    const s = buildCanvasSnippet(
      fakeCanvas({ imageService: undefined, imageUrl: undefined, thumbnail: "https://example.org/thumb.jpg" }),
      { insertWidth: 400, apiVersion: "3" },
    );
    assert.equal(s, "![f. 1r](https://example.org/thumb.jpg)");
  });

  it("throws when the canvas has no usable URL at all", () => {
    assert.throws(() =>
      buildCanvasSnippet(
        fakeCanvas({ imageService: undefined, imageUrl: undefined, thumbnail: undefined }),
        { insertWidth: 400, apiVersion: "3" },
      ),
    );
  });

  it("respects v2 size semantics (no caret, plain size)", () => {
    const s = buildCanvasSnippet(
      fakeCanvas({ imageService: { id: "https://example.org/iiif/2/abc" } }),
      { insertWidth: 400, apiVersion: "2" },
    );
    assert.ok(s.includes("/full/400,/0/default.jpg"));
    assert.ok(!s.includes("^"));
  });
});

describe("buildCanvasBatch", () => {
  it("concatenates snippets separated by blank lines", () => {
    const out = buildCanvasBatch(
      [
        fakeCanvas({ id: "c1", label: "f. 1r" }),
        fakeCanvas({ id: "c2", label: "f. 1v" }),
      ],
      { insertWidth: 400, apiVersion: "3" },
    );
    const lines = out.split("\n");
    assert.equal(lines.length, 3);
    assert.ok(lines[0]!.startsWith("![f. 1r]"));
    assert.equal(lines[1], "");
    assert.ok(lines[2]!.startsWith("![f. 1v]"));
  });

  it("returns empty string on empty input", () => {
    assert.equal(buildCanvasBatch([], { insertWidth: 100, apiVersion: "3" }), "");
  });
});
