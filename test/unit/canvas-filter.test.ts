import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterCanvases, paginate } from "../../src/core/iiif/canvas-filter.ts";
import type { IIIFCanvas } from "../../src/core/iiif/types.ts";

function canvas(label: string, i = 0): IIIFCanvas {
  return {
    id: `https://example.org/canvas/${i}`,
    label,
    width: 100,
    height: 100,
    seeAlso: [],
  };
}

describe("filterCanvases", () => {
  const corpus: IIIFCanvas[] = [
    canvas("f. 1r", 1),
    canvas("f. 1v", 2),
    canvas("f. 12r", 3),
    canvas("f. 12v", 4),
    canvas("f. 127r", 5),
    canvas("Garde", 6),
    canvas("Miniature — Crucifixion", 7),
  ];

  it("returns everything for empty query", () => {
    assert.equal(filterCanvases(corpus, "").length, corpus.length);
    assert.equal(filterCanvases(corpus, "   ").length, corpus.length);
  });

  it("substring-matches labels case-insensitively", () => {
    const out = filterCanvases(corpus, "12");
    assert.deepEqual(out.map((c) => c.label), ["f. 12r", "f. 12v", "f. 127r"]);
  });

  it("is case-insensitive", () => {
    assert.equal(filterCanvases(corpus, "CRUCIFIXION").length, 1);
  });

  it("is diacritic-insensitive (NFD normalisation)", () => {
    assert.equal(filterCanvases(corpus, "miniature").length, 1);
    assert.equal(filterCanvases(corpus, "garde").length, 1);
    const accented: IIIFCanvas[] = [canvas("Préface"), canvas("Suite")];
    assert.equal(filterCanvases(accented, "preface").length, 1);
  });

  it("returns empty on no match", () => {
    assert.equal(filterCanvases(corpus, "zzz").length, 0);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i);

  it("first page", () => {
    const p = paginate(items, 1, 10);
    assert.deepEqual(p.items, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(p.page, 1);
    assert.equal(p.totalPages, 3);
    assert.equal(p.total, 25);
  });

  it("last (partial) page", () => {
    const p = paginate(items, 3, 10);
    assert.deepEqual(p.items, [20, 21, 22, 23, 24]);
    assert.equal(p.page, 3);
  });

  it("clamps page number to [1, totalPages]", () => {
    assert.equal(paginate(items, 0, 10).page, 1);
    assert.equal(paginate(items, 99, 10).page, 3);
    assert.equal(paginate(items, -5, 10).page, 1);
  });

  it("totalPages is at least 1 even for empty input", () => {
    const p = paginate<number>([], 1, 10);
    assert.equal(p.totalPages, 1);
    assert.equal(p.items.length, 0);
  });

  it("rejects non-positive pageSize", () => {
    assert.throws(() => paginate(items, 1, 0));
    assert.throws(() => paginate(items, 1, -5));
  });
});
