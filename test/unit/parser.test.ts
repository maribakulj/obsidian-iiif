import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  detectKind,
  detectVersion,
  IIIFParseError,
  parseCollection,
  parseIIIF,
  parseManifest,
} from "../../src/core/iiif/parser.ts";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "manifests",
);

function load(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

describe("detectVersion", () => {
  it("recognizes v2 from @context", () => {
    assert.equal(detectVersion(load("v2-single-image.json")), "2");
    assert.equal(detectVersion(load("v2-book.json")), "2");
  });

  it("recognizes v3 from @context", () => {
    assert.equal(detectVersion(load("v3-single-image.json")), "3");
    assert.equal(detectVersion(load("v3-book.json")), "3");
  });

  it("returns null on non-object input", () => {
    assert.equal(detectVersion("hello"), null);
    assert.equal(detectVersion(null), null);
  });

  it("falls back to id/type shape when @context missing", () => {
    assert.equal(detectVersion({ id: "x", type: "Manifest" }), "3");
    assert.equal(detectVersion({ "@id": "x", "@type": "sc:Manifest" }), "2");
  });
});

describe("detectKind", () => {
  it("identifies v2 Manifest", () => {
    assert.equal(detectKind(load("v2-single-image.json")), "Manifest");
  });
  it("identifies v3 Manifest", () => {
    assert.equal(detectKind(load("v3-single-image.json")), "Manifest");
  });
  it("identifies v2 Collection", () => {
    assert.equal(detectKind(load("v2-collection.json")), "Collection");
  });
  it("identifies v3 Collection", () => {
    assert.equal(detectKind(load("v3-collection.json")), "Collection");
  });
});

describe("parseManifest — v2 single image", () => {
  const m = parseManifest(load("v2-single-image.json"));

  it("id, version, label", () => {
    assert.equal(m.version, "2");
    assert.equal(m.id, "https://example.org/iiif/book1/manifest");
    assert.equal(m.label, "Book 1");
  });

  it("summary from v2 description", () => {
    assert.equal(m.summary, "A single-page example manifest.");
  });

  it("metadata pairs", () => {
    assert.deepEqual(m.metadata, [
      { label: "Author", value: "Anne Author" },
      { label: "Published", value: "Paris, circa 1400" },
    ]);
  });

  it("rights from v2 license", () => {
    assert.equal(m.rights, "https://creativecommons.org/licenses/by/4.0/");
  });

  it("attribution mapped to requiredStatement", () => {
    assert.deepEqual(m.requiredStatement, {
      label: "Attribution",
      value: "Provided by Example Institution",
    });
  });

  it("thumbnail extracted", () => {
    assert.ok(m.thumbnail?.includes("/p1/full/80,"));
  });

  it("one canvas with image service", () => {
    assert.equal(m.canvases.length, 1);
    const c = m.canvases[0]!;
    assert.equal(c.label, "p. 1");
    assert.equal(c.width, 1200);
    assert.equal(c.height, 1800);
    assert.equal(c.imageService?.id, "https://example.org/iiif/book1/canvas/p1");
  });
});

describe("parseManifest — v2 book (multi-canvas)", () => {
  const m = parseManifest(load("v2-book.json"));

  it("label", () => {
    assert.equal(m.label, "Manuscrit 42 — Recueil de miniatures");
  });

  it("all canvases from sequences", () => {
    assert.equal(m.canvases.length, 3);
    assert.deepEqual(
      m.canvases.map((c) => c.label),
      ["f. 1r", "f. 1v", "f. 2r"],
    );
  });

  it("canvas dimensions preserved", () => {
    for (const c of m.canvases) {
      assert.equal(c.width, 3000);
      assert.equal(c.height, 4200);
    }
  });

  it("each canvas exposes an image service", () => {
    for (const c of m.canvases) {
      assert.ok(c.imageService?.id.includes("example.org/iiif/2/ms-42"));
    }
  });

  it("rich metadata carried over", () => {
    const labels = m.metadata.map((p) => p.label);
    assert.ok(labels.includes("Cote"));
    assert.ok(labels.includes("Support"));
  });
});

describe("parseManifest — v3 single image", () => {
  const m = parseManifest(load("v3-single-image.json"));

  it("version and label", () => {
    assert.equal(m.version, "3");
    assert.equal(m.label, "Single Image Example");
  });

  it("canvas from items[]", () => {
    assert.equal(m.canvases.length, 1);
    const c = m.canvases[0]!;
    assert.equal(c.label, "p. 1");
    assert.equal(c.width, 1200);
    assert.equal(c.height, 1800);
  });

  it("image service extracted from painting annotation body", () => {
    const svc = m.canvases[0]!.imageService;
    assert.equal(svc?.id, "https://example.org/iiif/3/single");
    assert.equal(svc?.type, "ImageService3");
  });
});

describe("parseManifest — v3 book (language maps)", () => {
  it("prefers French when requested", () => {
    const m = parseManifest(load("v3-book.json"), {
      preferredLanguages: ["fr", "en"],
    });
    assert.equal(m.label, "Livre d'heures à l'usage de Paris");
    assert.equal(m.summary, "Livre d'heures enluminé, Paris, vers 1450.");
  });

  it("prefers English when requested", () => {
    const m = parseManifest(load("v3-book.json"), {
      preferredLanguages: ["en"],
    });
    assert.equal(m.label, "Book of Hours for the use of Paris");
  });

  it("preserves metadata order", () => {
    const m = parseManifest(load("v3-book.json"), {
      preferredLanguages: ["fr"],
    });
    assert.deepEqual(
      m.metadata.map((p) => p.label),
      ["Titre", "Date", "Lieu", "Cote"],
    );
  });

  it("requiredStatement has both label and value in preferred language", () => {
    const m = parseManifest(load("v3-book.json"), {
      preferredLanguages: ["fr"],
    });
    assert.equal(m.requiredStatement?.value.startsWith("Fourni par"), true);
  });

  it("provider label", () => {
    const m = parseManifest(load("v3-book.json"), {
      preferredLanguages: ["fr"],
    });
    assert.equal(m.provider, "Bibliothèque d'Exemple");
  });

  it("three canvases in order", () => {
    const m = parseManifest(load("v3-book.json"));
    assert.equal(m.canvases.length, 3);
    assert.deepEqual(
      m.canvases.map((c) => c.label),
      ["f. 1r", "f. 1v", "f. 2r"],
    );
  });
});

describe("parseManifest — v3 seeAlso/rendering", () => {
  const m = parseManifest(load("v3-with-seealso.json"));

  it("captures manifest-level rendering", () => {
    assert.equal(m.rendering.length, 1);
    assert.equal(m.rendering[0]!.format, "application/pdf");
  });

  it("captures manifest-level seeAlso (ALTO + plain text)", () => {
    assert.equal(m.seeAlso.length, 2);
    const formats = m.seeAlso.map((r) => r.format);
    assert.ok(formats.includes("application/xml"));
    assert.ok(formats.includes("text/plain"));
  });

  it("captures per-canvas seeAlso", () => {
    assert.equal(m.canvases[0]!.seeAlso.length, 1);
    assert.equal(
      m.canvases[0]!.seeAlso[0]!.profile,
      "http://www.loc.gov/standards/alto/",
    );
  });
});

describe("parseManifest — edge cases", () => {
  it("falls back to a label derived from id when label is missing", () => {
    const m = parseManifest(load("edge-no-label.json"));
    assert.ok(m.label.length > 0);
    assert.ok(m.label.includes("example.org"));
  });

  it("respects preference cascade with multilingual labels", () => {
    const mLa = parseManifest(load("edge-mixed-languages.json"), {
      preferredLanguages: ["la"],
    });
    assert.equal(mLa.label, "Sacramentarium Gellonense");

    const mEn = parseManifest(load("edge-mixed-languages.json"), {
      preferredLanguages: ["en"],
    });
    assert.equal(mEn.label, "Sacramentary of Gellone");
  });

  it("falls back to `none` when preferred language absent", () => {
    const m = parseManifest(load("edge-mixed-languages.json"), {
      preferredLanguages: ["de"],
    });
    assert.equal(m.label, "BnF lat. 12048");
  });

  it("throws on non-object input", () => {
    assert.throws(() => parseManifest("not a manifest"), IIIFParseError);
  });
});

describe("parseCollection", () => {
  it("v2 collection: flattens `manifests` array", () => {
    const c = parseCollection(load("v2-collection.json"));
    assert.equal(c.version, "2");
    assert.equal(c.items.length, 3);
    assert.ok(c.items.every((i) => i.type === "Manifest"));
    assert.equal(c.items[0]!.label, "Beatus de Silos");
  });

  it("v3 collection: reads items[] of type Manifest", () => {
    const c = parseCollection(load("v3-collection.json"), {
      preferredLanguages: ["fr"],
    });
    assert.equal(c.version, "3");
    assert.equal(c.label, "Beatus de Liébana — corpus numérique");
    assert.equal(c.items.length, 3);
    assert.equal(c.items[0]!.label, "Beatus de Silos");
    assert.ok(c.items[0]!.thumbnail?.includes("thumb.jpg"));
  });
});

describe("parseIIIF — dispatcher", () => {
  it("dispatches a Manifest", () => {
    const r = parseIIIF(load("v3-single-image.json"));
    assert.equal("canvases" in r, true);
  });

  it("dispatches a Collection", () => {
    const r = parseIIIF(load("v3-collection.json"));
    assert.equal("items" in r, true);
  });

  it("throws on unrecognized resource", () => {
    assert.throws(
      () => parseIIIF({ "@context": "http://iiif.io/api/presentation/3/context.json", type: "Other" }),
      IIIFParseError,
    );
  });
});
