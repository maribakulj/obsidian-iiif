import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampRect,
  displayToSource,
  normalizeDrag,
  rectIsTrivial,
  sourceToDisplay,
} from "../../src/core/iiif/region-math.ts";

describe("normalizeDrag", () => {
  it("forward drag yields positive w/h", () => {
    assert.deepEqual(
      normalizeDrag({ x: 10, y: 20 }, { x: 110, y: 70 }),
      { x: 10, y: 20, w: 100, h: 50 },
    );
  });

  it("backward drag flips origin", () => {
    assert.deepEqual(
      normalizeDrag({ x: 110, y: 70 }, { x: 10, y: 20 }),
      { x: 10, y: 20, w: 100, h: 50 },
    );
  });

  it("mixed-direction drag produces absolute extents", () => {
    assert.deepEqual(
      normalizeDrag({ x: 50, y: 50 }, { x: 20, y: 80 }),
      { x: 20, y: 50, w: 30, h: 30 },
    );
  });
});

describe("clampRect", () => {
  const bounds = { w: 100, h: 100 };

  it("keeps an in-bounds rect unchanged", () => {
    const r = { x: 10, y: 10, w: 20, h: 20 };
    assert.deepEqual(clampRect(r, bounds), r);
  });

  it("clips width/height that extend past the right/bottom", () => {
    assert.deepEqual(
      clampRect({ x: 80, y: 80, w: 50, h: 50 }, bounds),
      { x: 80, y: 80, w: 20, h: 20 },
    );
  });

  it("clips a rect whose origin is negative", () => {
    assert.deepEqual(
      clampRect({ x: -10, y: -5, w: 50, h: 20 }, bounds),
      { x: 0, y: 0, w: 50, h: 20 },
    );
  });
});

describe("displayToSource", () => {
  it("scales up from a thumbnail to original source pixels", () => {
    const display = { x: 100, y: 50, w: 200, h: 100 };
    const displayDim = { w: 1000, h: 800 };
    const sourceDim = { w: 3000, h: 2400 };
    assert.deepEqual(displayToSource(display, displayDim, sourceDim), {
      x: 300,
      y: 150,
      w: 600,
      h: 300,
    });
  });

  it("clamps the source coords so (x+w, y+h) <= source dims", () => {
    const display = { x: 990, y: 790, w: 50, h: 50 };
    const displayDim = { w: 1000, h: 800 };
    const sourceDim = { w: 3000, h: 2400 };
    const out = displayToSource(display, displayDim, sourceDim);
    assert.ok(out.x + out.w <= sourceDim.w);
    assert.ok(out.y + out.h <= sourceDim.h);
    assert.ok(out.w >= 1 && out.h >= 1);
  });

  it("rounds to integers (Image API requires ints)", () => {
    const out = displayToSource(
      { x: 1, y: 1, w: 1, h: 1 },
      { w: 3, h: 3 },
      { w: 10, h: 10 },
    );
    assert.ok(Number.isInteger(out.x));
    assert.ok(Number.isInteger(out.y));
    assert.ok(Number.isInteger(out.w));
    assert.ok(Number.isInteger(out.h));
  });

  it("throws when any dimension is zero or negative", () => {
    assert.throws(() =>
      displayToSource({ x: 0, y: 0, w: 1, h: 1 }, { w: 0, h: 10 }, { w: 10, h: 10 }),
    );
    assert.throws(() =>
      displayToSource({ x: 0, y: 0, w: 1, h: 1 }, { w: 10, h: 10 }, { w: 10, h: 0 }),
    );
  });
});

describe("sourceToDisplay", () => {
  it("is the inverse of displayToSource (within rounding)", () => {
    const source = { x: 300, y: 150, w: 600, h: 300 };
    const displayDim = { w: 1000, h: 800 };
    const sourceDim = { w: 3000, h: 2400 };
    const display = sourceToDisplay(source, displayDim, sourceDim);
    assert.deepEqual(display, { x: 100, y: 50, w: 200, h: 100 });
  });
});

describe("rectIsTrivial", () => {
  it("flags tiny rects as trivial", () => {
    assert.equal(rectIsTrivial({ x: 0, y: 0, w: 2, h: 10 }), true);
    assert.equal(rectIsTrivial({ x: 0, y: 0, w: 10, h: 2 }), true);
  });
  it("accepts sensible rects", () => {
    assert.equal(rectIsTrivial({ x: 0, y: 0, w: 5, h: 5 }), false);
  });
});
