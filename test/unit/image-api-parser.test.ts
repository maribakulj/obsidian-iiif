import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseImageApiUrl,
  parseRegion,
  regionToXywh,
} from "../../src/core/annotation/image-api-parser.ts";

describe("parseImageApiUrl", () => {
  it("decodes a v3 region URL", () => {
    const url = "https://example.org/iiif/3/abc/100,200,300,400/500,/0/default.jpg";
    assert.deepEqual(parseImageApiUrl(url), {
      service: "https://example.org/iiif/3/abc",
      region: "100,200,300,400",
      size: "500,",
      rotation: "0",
      quality: "default",
      format: "jpg",
    });
  });

  it("decodes a full/max URL (whole canvas)", () => {
    const url = "https://example.org/iiif/3/abc/full/max/0/default.jpg";
    const out = parseImageApiUrl(url);
    assert.equal(out?.region, "full");
    assert.equal(out?.size, "max");
  });

  it("decodes a percent-region URL", () => {
    const url = "https://example.org/iiif/3/abc/pct:10,10,80,80/400,/0/gray.png";
    const out = parseImageApiUrl(url);
    assert.equal(out?.region, "pct:10,10,80,80");
    assert.equal(out?.quality, "gray");
    assert.equal(out?.format, "png");
  });

  it("decodes a !w,h bestFit size", () => {
    const url = "https://example.org/iiif/3/abc/full/!400,300/0/default.jpg";
    assert.equal(parseImageApiUrl(url)?.size, "!400,300");
  });

  it("decodes the v3 ^max upscale prefix", () => {
    const url = "https://example.org/iiif/3/abc/full/^max/0/default.jpg";
    assert.equal(parseImageApiUrl(url)?.size, "^max");
  });

  it("decodes a mirrored rotation (!90)", () => {
    const url = "https://example.org/iiif/3/abc/full/max/!90/default.jpg";
    assert.equal(parseImageApiUrl(url)?.rotation, "!90");
  });

  it("returns null for non-Image-API URLs", () => {
    assert.equal(parseImageApiUrl("https://example.org/just/a/page"), null);
    assert.equal(parseImageApiUrl("not a url"), null);
    assert.equal(parseImageApiUrl("https://example.org/x/y/garbage/0/default.jpg"), null);
  });

  it("returns null when the format is missing", () => {
    assert.equal(
      parseImageApiUrl("https://example.org/iiif/3/abc/full/max/0/default"),
      null,
    );
  });
});

describe("parseRegion", () => {
  it("decodes full / square", () => {
    assert.deepEqual(parseRegion("full"), { kind: "full" });
    assert.deepEqual(parseRegion("square"), { kind: "square" });
  });

  it("decodes absolute x,y,w,h", () => {
    assert.deepEqual(parseRegion("100,200,300,400"), {
      kind: "absolute",
      x: 100,
      y: 200,
      w: 300,
      h: 400,
    });
  });

  it("decodes percent regions", () => {
    assert.deepEqual(parseRegion("pct:10,20,30,40"), {
      kind: "percent",
      x: 10,
      y: 20,
      w: 30,
      h: 40,
    });
  });

  it("returns null on garbage", () => {
    assert.equal(parseRegion("hello"), null);
    assert.equal(parseRegion("1,2,3"), null);
    assert.equal(parseRegion("1.5,2,3,4"), null);
  });
});

describe("regionToXywh", () => {
  it("emits xywh= for absolute regions", () => {
    assert.equal(
      regionToXywh({ kind: "absolute", x: 1, y: 2, w: 3, h: 4 }),
      "xywh=1,2,3,4",
    );
  });

  it("returns null for full / square / percent (Media Fragments needs source dims)", () => {
    assert.equal(regionToXywh({ kind: "full" }), null);
    assert.equal(regionToXywh({ kind: "square" }), null);
    assert.equal(
      regionToXywh({ kind: "percent", x: 0, y: 0, w: 50, h: 50 }),
      null,
    );
  });
});
