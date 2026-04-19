import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { serializeFrontmatter } from "../../src/core/note/frontmatter.ts";

describe("serializeFrontmatter", () => {
  it("emits plain key:value lines", () => {
    assert.equal(
      serializeFrontmatter({ title: "Book", count: 42, ok: true }),
      "title: Book\ncount: 42\nok: true\n",
    );
  });

  it("skips undefined and null", () => {
    assert.equal(
      serializeFrontmatter({ a: undefined, b: null, c: 1 }),
      "c: 1\n",
    );
  });

  it("emits arrays as YAML block sequences", () => {
    assert.equal(
      serializeFrontmatter({ tags: ["iiif", "manuscript"] }),
      "tags:\n  - iiif\n  - manuscript\n",
    );
  });

  it("skips empty arrays", () => {
    assert.equal(serializeFrontmatter({ tags: [] }), "");
  });

  it("quotes strings containing colons", () => {
    const out = serializeFrontmatter({ url: "http://x.org/a" });
    assert.match(out, /^url: '/);
  });

  it("doubles single quotes inside quoted strings", () => {
    const out = serializeFrontmatter({ s: "it's fine" });
    assert.match(out, /'it''s fine'/);
  });

  it("quotes strings that look like booleans/null", () => {
    assert.match(serializeFrontmatter({ s: "true" }), /'true'/);
    assert.match(serializeFrontmatter({ s: "null" }), /'null'/);
    assert.match(serializeFrontmatter({ s: "Yes" }), /'Yes'/);
  });

  it("quotes strings that look like numbers", () => {
    assert.match(serializeFrontmatter({ s: "42" }), /'42'/);
    assert.match(serializeFrontmatter({ s: "3.14" }), /'3.14'/);
  });

  it("quotes strings starting/ending with whitespace", () => {
    assert.match(serializeFrontmatter({ s: " leading" }), /' leading'/);
  });

  it("handles non-finite numbers as null", () => {
    assert.match(serializeFrontmatter({ s: Number.NaN }), /s: null/);
  });
});
