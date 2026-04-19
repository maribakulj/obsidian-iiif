import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRegionSnippet } from "../../src/core/note/region-snippet.ts";

const SVC = "https://example.org/iiif/3/ms-42-f001r";

describe("buildRegionSnippet", () => {
  it("emits a Markdown image embed with a v3 Image API URL", () => {
    const s = buildRegionSnippet({
      service: SVC,
      source: { x: 100, y: 200, w: 800, h: 600 },
      displayWidth: 500,
      apiVersion: "3",
      caption: "marginalia",
    });
    assert.equal(
      s,
      `![marginalia](${SVC}/100,200,800,600/500,/0/default.jpg)`,
    );
  });

  it("works for v2 services too", () => {
    const s = buildRegionSnippet({
      service: "https://example.org/iiif/2/ms",
      source: { x: 0, y: 0, w: 10, h: 10 },
      displayWidth: 100,
      apiVersion: "2",
    });
    assert.ok(s.includes("/0,0,10,10/100,/0/default.jpg"));
    // No upscale caret, no v3 prefix
    assert.ok(!s.includes("^"));
  });

  it("defaults to an empty caption when none is given", () => {
    const s = buildRegionSnippet({
      service: SVC,
      source: { x: 1, y: 2, w: 3, h: 4 },
      displayWidth: 50,
      apiVersion: "3",
    });
    assert.ok(s.startsWith("![]("));
  });

  it("sanitizes newlines out of the caption (markdown safety)", () => {
    const s = buildRegionSnippet({
      service: SVC,
      source: { x: 0, y: 0, w: 5, h: 5 },
      displayWidth: 50,
      apiVersion: "3",
      caption: "line one\nline two",
    });
    assert.match(s, /!\[line one line two\]/);
  });

  it("throws when source rect has zero width", () => {
    assert.throws(() =>
      buildRegionSnippet({
        service: SVC,
        source: { x: 0, y: 0, w: 0, h: 5 },
        displayWidth: 50,
        apiVersion: "3",
      }),
    );
  });
});
