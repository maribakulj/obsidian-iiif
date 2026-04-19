import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractIIIFEmbeds, stripFrontmatter } from "../../src/core/annotation/extract.ts";

describe("extractIIIFEmbeds", () => {
  it("captures every region embed and ignores other URLs", () => {
    const body = [
      "Some text.",
      "![marginalia](https://example.org/iiif/3/abc/100,200,300,400/500,/0/default.jpg)",
      "More text.",
      "![](https://example.org/iiif/3/abc/full/max/0/default.jpg)",
      "![not iiif](https://example.org/regular.png)",
    ].join("\n");
    const out = extractIIIFEmbeds(body);
    assert.equal(out.length, 2);
    assert.equal(out[0]!.caption, "marginalia");
    assert.equal(out[0]!.region.kind, "absolute");
    assert.equal(out[1]!.caption, "");
    assert.equal(out[1]!.region.kind, "full");
  });

  it("preserves document order", () => {
    const body = [
      "![first](https://x.org/iiif/a/0,0,10,10/max/0/default.jpg)",
      "![second](https://x.org/iiif/b/0,0,20,20/max/0/default.jpg)",
      "![third](https://x.org/iiif/c/0,0,30,30/max/0/default.jpg)",
    ].join("\n\n");
    const out = extractIIIFEmbeds(body);
    assert.deepEqual(out.map((e) => e.caption), ["first", "second", "third"]);
  });

  it("returns empty list for a note with no embeds", () => {
    assert.equal(extractIIIFEmbeds("# Just a heading\n\nProse.").length, 0);
  });
});

describe("stripFrontmatter", () => {
  it("strips a standard `---` block", () => {
    const content = "---\ntitle: Foo\n---\n\nBody here.";
    assert.equal(stripFrontmatter(content), "Body here.");
  });

  it("returns input unchanged when no frontmatter is present", () => {
    assert.equal(stripFrontmatter("# Heading"), "# Heading");
  });

  it("tolerates an unterminated frontmatter (no second ---)", () => {
    const content = "---\ntitle: Foo\nBody";
    // No closing delimiter → return as-is to avoid silent data loss.
    assert.equal(stripFrontmatter(content), content);
  });
});
