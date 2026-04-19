import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildImageUrl,
  buildRegionUrl,
  buildThumbnailUrl,
} from "../../src/core/iiif/image-api.ts";

const SVC = "https://example.org/iiif/3/abc";

describe("buildImageUrl — defaults", () => {
  it("builds a full/max/0/default.jpg URL with only a service", () => {
    assert.equal(
      buildImageUrl({ service: SVC }),
      `${SVC}/full/max/0/default.jpg`,
    );
  });

  it("strips a trailing slash from the service", () => {
    assert.equal(
      buildImageUrl({ service: `${SVC}/` }),
      `${SVC}/full/max/0/default.jpg`,
    );
  });

  it("throws when service is empty", () => {
    assert.throws(() => buildImageUrl({ service: "" }), /service/);
  });
});

describe("region", () => {
  it("full", () => {
    assert.match(
      buildImageUrl({ service: SVC, region: { kind: "full" } }),
      /\/full\//,
    );
  });

  it("square", () => {
    assert.match(
      buildImageUrl({ service: SVC, region: { kind: "square" } }),
      /\/square\//,
    );
  });

  it("absolute x,y,w,h", () => {
    const url = buildImageUrl({
      service: SVC,
      region: { kind: "absolute", x: 100, y: 200, w: 300, h: 400 },
    });
    assert.match(url, /\/100,200,300,400\//);
  });

  it("percent uses pct: prefix", () => {
    const url = buildImageUrl({
      service: SVC,
      region: { kind: "percent", x: 10, y: 20, w: 30, h: 40 },
    });
    assert.match(url, /\/pct:10,20,30,40\//);
  });

  it("rejects negative absolute coords", () => {
    assert.throws(() =>
      buildImageUrl({
        service: SVC,
        region: { kind: "absolute", x: -1, y: 0, w: 10, h: 10 },
      }),
    );
  });

  it("rejects zero-width absolute region", () => {
    assert.throws(() =>
      buildImageUrl({
        service: SVC,
        region: { kind: "absolute", x: 0, y: 0, w: 0, h: 10 },
      }),
    );
  });

  it("rejects non-integer absolute coords", () => {
    assert.throws(() =>
      buildImageUrl({
        service: SVC,
        region: { kind: "absolute", x: 1.5, y: 0, w: 10, h: 10 },
      }),
    );
  });

  it("rejects percent > 100", () => {
    assert.throws(() =>
      buildImageUrl({
        service: SVC,
        region: { kind: "percent", x: 0, y: 0, w: 150, h: 10 },
      }),
    );
  });
});

describe("size", () => {
  it("max is the default", () => {
    assert.match(buildImageUrl({ service: SVC }), /\/max\//);
  });

  it("width `w,`", () => {
    assert.match(
      buildImageUrl({ service: SVC, size: { kind: "width", w: 400 } }),
      /\/400,\//,
    );
  });

  it("height `,h`", () => {
    assert.match(
      buildImageUrl({ service: SVC, size: { kind: "height", h: 500 } }),
      /\/,500\//,
    );
  });

  it("exact `w,h`", () => {
    assert.match(
      buildImageUrl({ service: SVC, size: { kind: "exact", w: 100, h: 200 } }),
      /\/100,200\//,
    );
  });

  it("bestFit `!w,h`", () => {
    assert.match(
      buildImageUrl({ service: SVC, size: { kind: "bestFit", w: 800, h: 600 } }),
      /\/!800,600\//,
    );
  });

  it("percent `pct:n`", () => {
    assert.match(
      buildImageUrl({ service: SVC, size: { kind: "percent", pct: 50 } }),
      /\/pct:50\//,
    );
  });

  it("v3 upscale prepends `^`", () => {
    assert.match(
      buildImageUrl({
        service: SVC,
        size: { kind: "width", w: 4000, upscale: true },
        apiVersion: "3",
      }),
      /\/\^4000,\//,
    );
  });

  it("v2 rejects upscale prefix", () => {
    assert.throws(() =>
      buildImageUrl({
        service: SVC,
        size: { kind: "max", upscale: true },
        apiVersion: "2",
      }),
    );
  });

  it("`full` is v2 only", () => {
    assert.match(
      buildImageUrl({ service: SVC, size: { kind: "full" }, apiVersion: "2" }),
      /\/full\//,
    );
    assert.throws(() =>
      buildImageUrl({ service: SVC, size: { kind: "full" }, apiVersion: "3" }),
    );
  });
});

describe("rotation / mirror", () => {
  it("0 by default", () => {
    assert.match(buildImageUrl({ service: SVC }), /\/0\/default/);
  });

  it("integer rotation", () => {
    assert.match(buildImageUrl({ service: SVC, rotation: 90 }), /\/90\/default/);
  });

  it("mirror prepends `!`", () => {
    assert.match(
      buildImageUrl({ service: SVC, rotation: 180, mirror: true }),
      /\/!180\//,
    );
  });

  it("rejects out-of-range rotation", () => {
    assert.throws(() => buildImageUrl({ service: SVC, rotation: 361 }));
    assert.throws(() => buildImageUrl({ service: SVC, rotation: -1 }));
  });
});

describe("quality / format", () => {
  it("default/jpg by default", () => {
    assert.ok(buildImageUrl({ service: SVC }).endsWith("/default.jpg"));
  });

  it("custom quality and format", () => {
    assert.ok(
      buildImageUrl({ service: SVC, quality: "gray", format: "png" }).endsWith(
        "/gray.png",
      ),
    );
  });
});

describe("convenience helpers", () => {
  it("buildThumbnailUrl", () => {
    assert.equal(
      buildThumbnailUrl(SVC, 200),
      `${SVC}/full/200,/0/default.jpg`,
    );
  });

  it("buildRegionUrl with displayWidth", () => {
    assert.equal(
      buildRegionUrl(SVC, { x: 10, y: 20, w: 300, h: 400 }, 150),
      `${SVC}/10,20,300,400/150,/0/default.jpg`,
    );
  });

  it("buildRegionUrl without displayWidth uses max", () => {
    assert.equal(
      buildRegionUrl(SVC, { x: 10, y: 20, w: 300, h: 400 }),
      `${SVC}/10,20,300,400/max/0/default.jpg`,
    );
  });
});
