import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffManifests } from "../../src/core/iiif/diff.ts";
import type { IIIFCanvas, IIIFManifest } from "../../src/core/iiif/types.ts";

function canvas(id: string, label: string): IIIFCanvas {
  return { id, label, width: 10, height: 10, seeAlso: [] };
}

function manifest(over: Partial<IIIFManifest> = {}): IIIFManifest {
  return {
    id: "https://example.org/m",
    version: "3",
    label: "Manifest",
    metadata: [],
    canvases: [],
    rendering: [],
    seeAlso: [],
    raw: null,
    ...over,
  };
}

describe("diffManifests", () => {
  it("reports unchanged when nothing differs", () => {
    const m = manifest({ canvases: [canvas("c1", "f. 1r")] });
    const d = diffManifests(m, { ...m });
    assert.equal(d.unchanged, true);
    assert.deepEqual(d.scalarChanges, []);
    assert.deepEqual(d.addedCanvases, []);
    assert.deepEqual(d.removedCanvases, []);
  });

  it("detects scalar label/provider/rights changes", () => {
    const a = manifest({ label: "Old", provider: "P1", rights: "r1" });
    const b = manifest({ label: "New", provider: "P2", rights: "r2" });
    const d = diffManifests(a, b);
    const fields = d.scalarChanges.map((c) => c.field).sort();
    assert.deepEqual(fields, ["label", "provider", "rights"]);
    assert.equal(d.unchanged, false);
  });

  it("detects canvas count scalar change", () => {
    const a = manifest({ canvases: [canvas("c1", "x")] });
    const b = manifest({ canvases: [canvas("c1", "x"), canvas("c2", "y")] });
    const d = diffManifests(a, b);
    const countChange = d.scalarChanges.find((c) => c.field === "canvas_count");
    assert.ok(countChange);
    assert.equal(countChange.from, "1");
    assert.equal(countChange.to, "2");
  });

  it("reports added and removed canvases by id", () => {
    const a = manifest({
      canvases: [canvas("c1", "one"), canvas("c2", "two")],
    });
    const b = manifest({
      canvases: [canvas("c1", "one"), canvas("c3", "three")],
    });
    const d = diffManifests(a, b);
    assert.deepEqual(d.addedCanvases, [{ id: "c3", label: "three" }]);
    assert.deepEqual(d.removedCanvases, [{ id: "c2", label: "two" }]);
  });

  it("reports relabeled canvases separately from added/removed", () => {
    const a = manifest({ canvases: [canvas("c1", "f. 1r")] });
    const b = manifest({ canvases: [canvas("c1", "f. 1r bis")] });
    const d = diffManifests(a, b);
    assert.deepEqual(d.addedCanvases, []);
    assert.deepEqual(d.removedCanvases, []);
    assert.deepEqual(d.relabeledCanvases, [
      { id: "c1", from: "f. 1r", to: "f. 1r bis" },
    ]);
  });

  it("surfaces canonical-metadata changes via the enrichment aliases", () => {
    const a = manifest({ metadata: [{ label: "Lieu", value: "Paris" }] });
    const b = manifest({ metadata: [{ label: "Place", value: "Rouen" }] });
    const d = diffManifests(a, b);
    const placeChange = d.metadataChanges.find((c) => c.field === "place");
    assert.ok(placeChange);
    assert.equal(placeChange.from, "Paris");
    assert.equal(placeChange.to, "Rouen");
  });
});
