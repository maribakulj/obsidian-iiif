import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AnnotationParseError,
  parseAnnotationDocument,
} from "../../src/core/annotation/parse.ts";

describe("parseAnnotationDocument", () => {
  it("reads an AnnotationPage with a SpecificResource target", () => {
    const doc = {
      "@context": "http://www.w3.org/ns/anno.jsonld",
      type: "AnnotationPage",
      id: "urn:uuid:page-1",
      partOf: { id: "https://example.org/m", type: "Manifest" },
      items: [
        {
          type: "Annotation",
          id: "urn:uuid:1",
          motivation: "commenting",
          body: { type: "TextualBody", value: "marginalia" },
          target: {
            type: "SpecificResource",
            source: "https://example.org/m/canvas/1",
            selector: {
              type: "FragmentSelector",
              conformsTo: "http://www.w3.org/TR/media-frags/",
              value: "xywh=100,200,300,400",
            },
          },
        },
      ],
    };
    const out = parseAnnotationDocument(doc);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.canvasId, "https://example.org/m/canvas/1");
    assert.deepEqual(out[0]!.xywh, { x: 100, y: 200, w: 300, h: 400 });
    assert.equal(out[0]!.body, "marginalia");
    assert.equal(out[0]!.manifestId, "https://example.org/m");
    assert.equal(out[0]!.motivation, "commenting");
  });

  it("inherits manifest id from the AnnotationPage when missing on items", () => {
    const doc = {
      type: "AnnotationPage",
      partOf: { id: "https://example.org/m", type: "Manifest" },
      items: [
        {
          type: "Annotation",
          body: "plain string body",
          target: { type: "SpecificResource", source: "https://example.org/c/1" },
        },
      ],
    };
    const [a] = parseAnnotationDocument(doc);
    assert.equal(a!.manifestId, "https://example.org/m");
  });

  it("accepts a bare Annotation", () => {
    const doc = {
      "@context": "http://www.w3.org/ns/anno.jsonld",
      type: "Annotation",
      body: { type: "TextualBody", value: "x" },
      target: "https://example.org/c/1#xywh=1,2,3,4",
    };
    const out = parseAnnotationDocument(doc);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.canvasId, "https://example.org/c/1");
    assert.deepEqual(out[0]!.xywh, { x: 1, y: 2, w: 3, h: 4 });
  });

  it("accepts an array of Annotations", () => {
    const out = parseAnnotationDocument([
      {
        type: "Annotation",
        body: "a",
        target: "https://example.org/c/1#xywh=0,0,1,1",
      },
      {
        type: "Annotation",
        body: "b",
        target: "https://example.org/c/2",
      },
    ]);
    assert.equal(out.length, 2);
    assert.equal(out[1]!.xywh, null);
  });

  it("uses the first textual body when body is an array", () => {
    const out = parseAnnotationDocument({
      type: "Annotation",
      body: [
        { type: "TextualBody", value: "first" },
        { type: "TextualBody", value: "second" },
      ],
      target: "https://example.org/c/1",
    });
    assert.equal(out[0]!.body, "first");
  });

  it("tolerates @id / @type alongside id / type", () => {
    const out = parseAnnotationDocument({
      "@type": "Annotation",
      "@id": "anno-1",
      body: "x",
      target: { "@id": "https://example.org/c/1", type: "SpecificResource", source: "https://example.org/c/1" },
    });
    assert.equal(out[0]!.id, "anno-1");
  });

  it("decodes pixel: prefix in xywh", () => {
    const out = parseAnnotationDocument({
      type: "Annotation",
      body: "x",
      target: {
        type: "SpecificResource",
        source: "https://example.org/c/1",
        selector: {
          type: "FragmentSelector",
          conformsTo: "http://www.w3.org/TR/media-frags/",
          value: "xywh=pixel:5,10,20,30",
        },
      },
    });
    assert.deepEqual(out[0]!.xywh, { x: 5, y: 10, w: 20, h: 30 });
  });

  it("throws on non-object input", () => {
    assert.throws(() => parseAnnotationDocument("hello"), AnnotationParseError);
    assert.throws(() => parseAnnotationDocument(null), AnnotationParseError);
  });

  it("returns empty list when items[] has no parseable annotations", () => {
    const out = parseAnnotationDocument({ type: "AnnotationPage", items: [{ wrong: "shape" }] });
    assert.equal(out.length, 0);
  });
});
