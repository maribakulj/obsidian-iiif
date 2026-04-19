import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAnnotationPage,
  serializeAnnotationPage,
} from "../../src/core/annotation/build.ts";
import type { ExtractedEmbed } from "../../src/core/annotation/extract.ts";
import type { IIIFManifest } from "../../src/core/iiif/types.ts";

const SVC = "https://example.org/iiif/3/abc";

function manifest(): IIIFManifest {
  return {
    id: "https://example.org/m",
    version: "3",
    label: "M",
    metadata: [],
    canvases: [
      {
        id: "https://example.org/m/canvas/1",
        label: "f. 1r",
        width: 3000,
        height: 4000,
        imageService: { id: SVC },
        seeAlso: [],
      },
    ],
    rendering: [],
    seeAlso: [],
    raw: null,
  };
}

function embed(over: Partial<ExtractedEmbed> = {}): ExtractedEmbed {
  return {
    caption: "marginalia",
    url: `${SVC}/100,200,300,400/500,/0/default.jpg`,
    parts: {
      service: SVC,
      region: "100,200,300,400",
      size: "500,",
      rotation: "0",
      quality: "default",
      format: "jpg",
    },
    region: { kind: "absolute", x: 100, y: 200, w: 300, h: 400 },
    ...over,
  };
}

const FIXED = new Date("2026-04-19T00:00:00Z");
let counter = 0;
const stableUuid = (): string => `00000000-0000-0000-0000-${String(++counter).padStart(12, "0")}`;

describe("buildAnnotationPage", () => {
  it("produces an AnnotationPage with one item per matched embed", () => {
    counter = 0;
    const { page, unmatched } = buildAnnotationPage(
      [embed()],
      manifest(),
      { manifestUrl: "https://example.org/m", now: FIXED, uuid: stableUuid },
    );
    assert.equal(unmatched, 0);
    assert.equal(page.type, "AnnotationPage");
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]!.target.source, "https://example.org/m/canvas/1");
    assert.equal(page.items[0]!.target.selector?.value, "xywh=100,200,300,400");
    assert.equal(page.items[0]!.target.partOf?.id, "https://example.org/m");
  });

  it("counts embeds whose service doesn't match any canvas as unmatched", () => {
    const e = embed({
      parts: {
        ...embed().parts,
        service: "https://elsewhere.org/iiif/3/xyz",
      },
    });
    const { page, unmatched } = buildAnnotationPage([e], manifest(), {
      manifestUrl: "https://example.org/m",
    });
    assert.equal(page.items.length, 0);
    assert.equal(unmatched, 1);
  });

  it("omits the FragmentSelector for `full` regions (canvas-scope annotation)", () => {
    const e = embed({
      url: `${SVC}/full/max/0/default.jpg`,
      parts: { ...embed().parts, region: "full", size: "max" },
      region: { kind: "full" },
    });
    const { page } = buildAnnotationPage([e], manifest(), {
      manifestUrl: "https://example.org/m",
    });
    assert.equal(page.items[0]!.target.selector, undefined);
  });

  it("emits ISO timestamps and stable @context", () => {
    counter = 0;
    const { page } = buildAnnotationPage([embed()], manifest(), {
      manifestUrl: "https://example.org/m",
      now: FIXED,
      uuid: stableUuid,
    });
    assert.equal(page["@context"], "http://www.w3.org/ns/anno.jsonld");
    assert.equal(page.items[0]!["@context"], "http://www.w3.org/ns/anno.jsonld");
    assert.equal(page.items[0]!.created, "2026-04-19T00:00:00.000Z");
  });

  it("includes creator only when supplied", () => {
    const withCreator = buildAnnotationPage([embed()], manifest(), {
      manifestUrl: "https://example.org/m",
      creator: "researcher@example.org",
    });
    assert.equal(withCreator.page.items[0]!.creator, "researcher@example.org");
    const without = buildAnnotationPage([embed()], manifest(), {
      manifestUrl: "https://example.org/m",
    });
    assert.equal(without.page.items[0]!.creator, undefined);
  });
});

describe("serializeAnnotationPage", () => {
  it("emits parseable, indented JSON terminated with a newline", () => {
    counter = 0;
    const { page } = buildAnnotationPage([embed()], manifest(), {
      manifestUrl: "https://example.org/m",
      now: FIXED,
      uuid: stableUuid,
    });
    const json = serializeAnnotationPage(page);
    assert.ok(json.endsWith("\n"));
    assert.deepEqual(JSON.parse(json), page);
  });
});
