import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCollectionIndexNote,
  type CollectionImportReport,
} from "../../src/core/note/collection-builder.ts";
import type { IIIFCollection, IIIFCollectionEntry } from "../../src/core/iiif/types.ts";

function entry(over: Partial<IIIFCollectionEntry> = {}): IIIFCollectionEntry {
  return {
    id: "https://example.org/m/1",
    type: "Manifest",
    label: "Beatus de Silos",
    ...over,
  };
}

function collection(over: Partial<IIIFCollection> = {}): IIIFCollection {
  return {
    id: "https://example.org/collection/beatus",
    version: "3",
    label: "Beatus de Liébana — corpus",
    summary: "Corpus des manuscrits du Commentaire sur l'Apocalypse.",
    items: [],
    raw: null,
    ...over,
  };
}

const FIXED = new Date("2026-04-19T00:00:00Z");

describe("buildCollectionIndexNote", () => {
  it("emits frontmatter with collection URL, version, counts, tags", () => {
    const col = collection({ items: [entry()] });
    const reports: CollectionImportReport[] = [
      { entry: entry(), status: "imported", noteStem: "Beatus de Silos" },
    ];
    const out = buildCollectionIndexNote(col, {
      collectionUrl: col.id,
      importedAt: FIXED,
      reports,
    });
    assert.match(out, /iiif_collection: 'https:/);
    assert.match(out, /iiif_version: '3'/);
    assert.match(out, /item_count: 1/);
    assert.match(out, /imported_ok: 1/);
    assert.match(out, /tags:\n  - iiif\n  - iiif-collection/);
  });

  it("renders a manifest table with wiki-links for imports and placeholders for failures", () => {
    const col = collection({
      items: [entry({ label: "One" }), entry({ id: "https://ex/m/2", label: "Two" })],
    });
    const reports: CollectionImportReport[] = [
      { entry: col.items[0]!, status: "imported", noteStem: "One" },
      {
        entry: col.items[1]!,
        status: "failed",
        errorMessage: "network error",
      },
    ];
    const out = buildCollectionIndexNote(col, {
      collectionUrl: col.id,
      importedAt: FIXED,
      reports,
    });
    assert.match(out, /\| 1 \| One \| \[\[One\]\] \| ✅ imported \|/);
    assert.match(out, /\| 2 \| Two \| — \| ❌ network error \|/);
  });

  it("lists sub-collections without importing them", () => {
    const col = collection({
      items: [
        entry({ type: "Collection", label: "Sub A", id: "https://ex/col/a" }),
        entry({ label: "Manifest B" }),
      ],
    });
    const reports: CollectionImportReport[] = [
      { entry: col.items[0]!, status: "skipped" },
      { entry: col.items[1]!, status: "imported", noteStem: "Manifest B" },
    ];
    const out = buildCollectionIndexNote(col, {
      collectionUrl: col.id,
      importedAt: FIXED,
      reports,
    });
    assert.match(out, /## Sub-collections/);
    assert.match(out, /\[Sub A\]\(https:\/\/ex\/col\/a\)/);
  });

  it("includes the collection summary section when present", () => {
    const col = collection({ items: [entry()] });
    const out = buildCollectionIndexNote(col, {
      collectionUrl: col.id,
      importedAt: FIXED,
      reports: [{ entry: entry(), status: "imported", noteStem: "X" }],
    });
    assert.match(out, /## Description/);
    assert.match(out, /Corpus des manuscrits/);
  });

  it("escapes pipes inside cell labels (markdown safety)", () => {
    const weird = entry({ label: "Foo | bar" });
    const out = buildCollectionIndexNote(collection({ items: [weird] }), {
      collectionUrl: "x",
      importedAt: FIXED,
      reports: [{ entry: weird, status: "imported", noteStem: "Foo  bar" }],
    });
    assert.match(out, /Foo \\\| bar/);
  });
});
