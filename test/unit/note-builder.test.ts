import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseManifest } from "../../src/core/iiif/parser.ts";
import { buildManifestNote } from "../../src/core/note/builder.ts";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "manifests",
);

function load(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

const FIXED_DATE = new Date("2026-04-19T00:00:00Z");

const defaultOpts = {
  manifestUrl: "https://example.org/iiif/x/manifest.json",
  importedAt: FIXED_DATE,
  thumbnailWidth: 400,
  insertCanvasTable: true,
  maxCanvasesInTable: 50,
};

describe("buildManifestNote — v3 book", () => {
  const m = parseManifest(load("v3-book.json"), { preferredLanguages: ["fr"] });
  const note = buildManifestNote(m, defaultOpts);

  it("starts with frontmatter delimiters", () => {
    assert.ok(note.startsWith("---\n"));
    assert.ok(note.includes("\n---\n"));
  });

  it("frontmatter contains the manifest URL and version", () => {
    assert.match(note, /iiif_manifest: 'https:\/\/example\.org/);
    assert.match(note, /iiif_version: '3'/);
  });

  it("frontmatter contains canvas count and tags", () => {
    assert.match(note, /canvas_count: 3/);
    assert.match(note, /tags:\n  - iiif/);
  });

  it("frontmatter surfaces well-known metadata as Dataview-friendly keys", () => {
    assert.match(note, /date: /);
    assert.match(note, /lieu: Paris/);
    assert.match(note, /cote: /);
  });

  it("body has H1 with French label", () => {
    assert.match(note, /\n# Livre d'heures à l'usage de Paris/);
  });

  it("body has subtitle with provider and rights", () => {
    assert.match(note, /Bibliothèque d'Exemple/);
    assert.match(note, /creativecommons\.org/);
  });

  it("renders the metadata table", () => {
    assert.match(note, /## Métadonnées/);
    assert.match(note, /\| Titre \| Livre d'heures \|/);
  });

  it("renders the canvas table with all rows", () => {
    assert.match(note, /## Canvases \(3\)/);
    assert.match(note, /\| 1 \| f\. 1r \| 3000×4200 \|/);
    assert.match(note, /\| 3 \| f\. 2r \|/);
  });
});

describe("buildManifestNote — v2 book", () => {
  const m = parseManifest(load("v2-book.json"));
  const note = buildManifestNote(m, defaultOpts);

  it("declares iiif_version 2", () => {
    assert.match(note, /iiif_version: '2'/);
  });

  it("renders canvas table thumbnails using v2-formatted Image API URLs", () => {
    // v2 size param has no `^`, no caret prefix; default URL pattern check.
    assert.match(note, /\/full\/120,\/0\/default\.jpg/);
  });

  it("includes the v2 attribution as `Attribution`", () => {
    assert.match(note, /## Attribution/);
    assert.match(note, /Bibliothèque d'Exemple — domaine public/);
  });
});

describe("buildManifestNote — seeAlso/rendering", () => {
  const m = parseManifest(load("v3-with-seealso.json"));
  const note = buildManifestNote(m, defaultOpts);

  it("lists rendering and seeAlso under Ressources", () => {
    assert.match(note, /## Ressources/);
    assert.match(note, /Full PDF download/);
    assert.match(note, /ALTO XML transcription/);
    assert.match(note, /Plain text/);
  });
});

describe("buildManifestNote — canvas table truncation", () => {
  const m = parseManifest(load("v3-book.json"));
  const note = buildManifestNote(m, { ...defaultOpts, maxCanvasesInTable: 2 });

  it("truncates and emits a hint", () => {
    assert.match(note, /\| 2 \| f\. 1v/);
    assert.doesNotMatch(note, /\| 3 \| f\. 2r/);
    assert.match(note, /1 more canvases not shown/);
  });

  it("can suppress the canvas table entirely", () => {
    const off = buildManifestNote(m, { ...defaultOpts, insertCanvasTable: false });
    assert.doesNotMatch(off, /## Canvases/);
  });
});

describe("buildManifestNote — edge cases", () => {
  it("uses derived label when manifest lacks one", () => {
    const m = parseManifest(load("edge-no-label.json"));
    const note = buildManifestNote(m, defaultOpts);
    assert.match(note, /\n# \[example\.org/);
  });

  it("omits header thumbnail section when no thumbnail and no canvas service", () => {
    const m = parseManifest(load("edge-no-label.json"));
    const note = buildManifestNote(m, defaultOpts);
    // Image embed `![](`
    assert.doesNotMatch(note, /!\]\(/);
  });
});
