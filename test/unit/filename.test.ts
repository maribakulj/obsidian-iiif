import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildFilename, sanitize, uniquify } from "../../src/core/note/filename.ts";
import type { IIIFManifest } from "../../src/core/iiif/types.ts";

function fakeManifest(over: Partial<IIIFManifest> = {}): IIIFManifest {
  return {
    id: "https://example.org/iiif/abc123/manifest",
    version: "3",
    label: "Manuscrit 42 — recueil",
    metadata: [],
    canvases: [],
    rendering: [],
    seeAlso: [],
    raw: null,
    ...over,
  };
}

describe("sanitize", () => {
  it("strips forbidden filesystem characters", () => {
    assert.equal(sanitize('a/b\\c:d*e?f"g<h>i|j'), "abcdefghij");
  });
  it("strips Obsidian-special characters (#^[])", () => {
    assert.equal(sanitize("foo#bar^baz[qux]"), "foobarbazqux");
  });
  it("collapses whitespace and trims", () => {
    assert.equal(sanitize("  hello   world  "), "hello world");
  });
  it("caps at 200 chars", () => {
    assert.equal(sanitize("a".repeat(500)).length, 200);
  });
});

describe("buildFilename", () => {
  it("substitutes {{label}}", () => {
    assert.equal(
      buildFilename("{{label}}", fakeManifest({ label: "Book of Hours" })),
      "Book of Hours",
    );
  });

  it("substitutes {{id}} (last URL segment)", () => {
    assert.equal(
      buildFilename("{{id}}", fakeManifest()),
      "manifest",
    );
  });

  it("substitutes {{version}}", () => {
    assert.equal(
      buildFilename("v{{version}} — {{label}}", fakeManifest({ label: "X", version: "2" })),
      "v2 — X",
    );
  });

  it("falls back when template resolves to empty", () => {
    assert.equal(
      buildFilename("{{label}}", fakeManifest({ label: "" })),
      "Untitled IIIF manifest",
    );
  });

  it("sanitizes substituted label", () => {
    assert.equal(
      buildFilename("{{label}}", fakeManifest({ label: "Foo / Bar : Baz" })),
      "Foo Bar Baz",
    );
  });
});

describe("uniquify", () => {
  it("returns the name unchanged when no collision", () => {
    assert.equal(uniquify("Foo.md", () => false), "Foo.md");
  });

  it("appends ` 1`, ` 2`, ... before the extension on collision", () => {
    const taken = new Set(["Foo.md", "Foo 1.md"]);
    assert.equal(uniquify("Foo.md", (n) => taken.has(n)), "Foo 2.md");
  });

  it("works on extensionless filenames", () => {
    const taken = new Set(["Foo"]);
    assert.equal(uniquify("Foo", (n) => taken.has(n)), "Foo 1");
  });
});
